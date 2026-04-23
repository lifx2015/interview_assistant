"""
WebSocket ASR 路由 - 集成声纹识别
"""
import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.routers.sessions import get_sessions
from backend.services.asr_service import ASRService
from backend.services.voiceprint_service import voiceprint_service
from backend.services.llm_service import (
    analyze_answer_stream,
    incremental_analyze_stream,
    interview_evaluation_stream,
)

router = APIRouter()


# Track in-flight incremental analysis per session to prevent overlapping calls
_incremental_in_flight: dict[str, bool] = {}
_incremental_pending: dict[str, str] = {}  # session_id -> latest pending sentence
_incremental_start_time: dict[str, float] = {}  # session_id -> timestamp when in-flight started
_INCREMENTAL_TIMEOUT = 30.0  # seconds before forcing release of stuck in-flight flag


@router.websocket("/ws/asr/{session_id}")
async def asr_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()

    sessions = get_sessions()
    if session_id not in sessions:
        await websocket.send_json({"type": "error", "data": "Invalid session"})
        await websocket.close()
        return

    session = sessions[session_id]
    asr = ASRService()
    result_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    # Current speaker role, controlled by frontend or voiceprint
    current_role = "interviewer"

    # Accumulated sentences per role
    interviewer_text: list[str] = []
    candidate_text: list[str] = []

    # Full conversation history (completed QA pairs only)
    conversation_history: list[dict] = []

    # Current question being asked (accumulated interviewer text for this round)
    current_question = ""

    # Voiceprint settings
    voiceprint_enabled = False  # 是否启用了声纹识别自动切换
    recent_audio_chunks = []    # 用于声纹识别的音频缓冲区
    VOICEPRINT_CHUNK_COUNT = 5  # 每5个音频块检测一次

    def on_partial(text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({
                "type": "partial",
                "text": text,
                "sentence_id": sentence_id,
                "role": current_role,
            }),
            loop,
        )

    def on_sentence(text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({
                "type": "sentence",
                "text": text,
                "sentence_id": sentence_id,
                "role": current_role,
            }),
            loop,
        )

    def on_error(msg: str):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({"type": "error", "data": msg}),
            loop,
        )

    asr_started = False

    async def check_voiceprint_and_switch(audio_data: bytes):
        """使用声纹识别检测说话人并自动切换角色"""
        nonlocal current_role

        if not voiceprint_enabled:
            return

        # 检查是否有全局面试官声纹
        voiceprints = await voiceprint_service.get_global_voiceprints()
        if not voiceprints:
            return  # 没有录入面试官声纹，无法识别

        # 使用新的识别方法（带缓存）
        result = voiceprint_service.identify_speaker(
            audio_data=audio_data,
            threshold=0.5  # 降低阈值以适应实时音频片段
        )

        detected_role = result.get("role", "candidate")

        # 如果识别结果发生变化
        if detected_role != current_role:
            print(f"[Voiceprint] Detected role change: {current_role} -> {detected_role} (confidence: {result.get('confidence', 0):.2f}, cached: {result.get('cached', False)})")
            current_role = detected_role
            await websocket.send_json({
                "type": "role_switched",
                "role": current_role,
                "detected_by": "voiceprint",
                "confidence": result.get("confidence", 0),
                "cached": result.get("cached", False),
            })

    async def run_incremental_analysis(sentence: str):
        """Run incremental analysis for a candidate sentence. Handles debouncing with timeout."""
        if _incremental_in_flight.get(session_id):
            # Check if the in-flight call has timed out
            start_time = _incremental_start_time.get(session_id, 0)
            if time.monotonic() - start_time > _INCREMENTAL_TIMEOUT:
                _incremental_in_flight[session_id] = False
                _incremental_start_time.pop(session_id, None)
            else:
                _incremental_pending[session_id] = sentence
                return

        _incremental_in_flight[session_id] = True
        _incremental_start_time[session_id] = time.monotonic()
        try:
            await _do_incremental_analysis(sentence)

            pending = _incremental_pending.pop(session_id, None)
            if pending:
                await run_incremental_analysis(pending)
        finally:
            _incremental_in_flight[session_id] = False
            _incremental_start_time.pop(session_id, None)

    async def _do_incremental_analysis(sentence: str):
        accumulated = "".join(candidate_text)
        resume_ctx = session.get("resume_text", "")

        try:
            async for chunk in incremental_analyze_stream(
                resume_context=resume_ctx,
                current_sentence=sentence,
                accumulated_answer=accumulated,
                current_question=current_question,
                conversation_history=conversation_history,
            ):
                await websocket.send_json({
                    "type": "follow_up_stream",
                    "data": chunk,
                })

            await websocket.send_json({
                "type": "follow_up_complete",
            })
        except Exception as e:
            await websocket.send_json({
                "type": "error",
                "data": f"Incremental analysis failed: {str(e)}",
            })

    try:
        async def forward_results():
            while True:
                item = await result_queue.get()
                if item["type"] == "error":
                    await websocket.send_json(item)
                    continue
                await websocket.send_json(item)

                if item["type"] == "sentence":
                    if item["role"] == "interviewer":
                        interviewer_text.append(item["text"])
                        # Update current question as interviewer speaks
                        current_question = "".join(interviewer_text)
                    else:
                        candidate_text.append(item["text"])
                        # Trigger incremental analysis for each candidate sentence
                        asyncio.create_task(
                            run_incremental_analysis(item["text"])
                        )

        forward_task = asyncio.create_task(forward_results())

        while True:
            raw = await websocket.receive()

            if "bytes" in raw and raw["bytes"]:
                audio_data = raw["bytes"]

                # 收集音频块用于声纹识别
                if voiceprint_enabled:
                    recent_audio_chunks.append(audio_data)
                    if len(recent_audio_chunks) >= VOICEPRINT_CHUNK_COUNT:
                        # 合并音频块进行声纹识别
                        combined_audio = b"".join(recent_audio_chunks)
                        await check_voiceprint_and_switch(combined_audio)
                        recent_audio_chunks = []  # 清空缓冲区

                if not asr_started:
                    asr.start(on_partial=on_partial, on_sentence=on_sentence, on_error=on_error)
                    asr_started = True
                asr.send_audio_data(audio_data)

            elif "text" in raw and raw["text"]:
                msg = json.loads(raw["text"])

                if msg.get("type") == "control":
                    action = msg.get("action", "")

                    if action == "switch_role":
                        new_role = msg.get("role", "interviewer")
                        current_role = new_role
                        await websocket.send_json({
                            "type": "role_switched",
                            "role": current_role,
                            "detected_by": "manual",
                        })

                    elif action == "enable_voiceprint":
                        voiceprint_enabled = True
                        await websocket.send_json({
                            "type": "voiceprint_status",
                            "enabled": True,
                            "message": "声纹识别已启用"
                        })

                    elif action == "disable_voiceprint":
                        voiceprint_enabled = False
                        recent_audio_chunks = []
                        await websocket.send_json({
                            "type": "voiceprint_status",
                            "enabled": False,
                            "message": "声纹识别已禁用"
                        })

                    elif action == "answer_complete":
                        if asr_started:
                            asr.stop()
                            asr_started = False

                        # Cancel any pending incremental analysis
                        _incremental_in_flight.pop(session_id, None)
                        _incremental_pending.pop(session_id, None)
                        _incremental_start_time.pop(session_id, None)

                        full_answer = "".join(candidate_text)
                        full_question = "".join(interviewer_text)
                        candidate_text.clear()
                        interviewer_text.clear()
                        current_question = ""

                        # Add to conversation history
                        conversation_history.append({
                            "question": full_question,
                            "answer": full_answer,
                        })

                        # Send clear signal to frontend to reset follow-up state
                        await websocket.send_json({
                            "type": "follow_up_clear",
                        })

                        session["qa_history"].append({
                            "question": full_question,
                            "answer": full_answer,
                        })

                        await websocket.send_json({
                            "type": "answer_complete_ack",
                            "question": full_question,
                            "answer": full_answer,
                        })

                    elif action == "pause":
                        if asr_started:
                            asr.stop()
                            asr_started = False

                    elif action == "resume":
                        if not asr_started:
                            asr.start(on_partial=on_partial, on_sentence=on_sentence, on_error=on_error)
                            asr_started = True

                    elif action == "stop":
                        # Generate interview evaluation before closing
                        if asr_started:
                            asr.stop()
                            asr_started = False

                        _incremental_in_flight.pop(session_id, None)
                        _incremental_pending.pop(session_id, None)
                        _incremental_start_time.pop(session_id, None)

                        resume_ctx = session.get("resume_text", "")
                        qa = session.get("qa_history", [])

                        if qa:
                            await websocket.send_json({
                                "type": "evaluation_start",
                            })
                            async for chunk in interview_evaluation_stream(
                                resume_context=resume_ctx,
                                qa_history=qa,
                            ):
                                await websocket.send_json({
                                    "type": "evaluation_stream",
                                    "data": chunk,
                                })
                            await websocket.send_json({
                                "type": "evaluation_complete",
                            })

                        break

    except WebSocketDisconnect:
        pass
    finally:
        if asr_started:
            asr.stop()
        forward_task.cancel()
        _incremental_in_flight.pop(session_id, None)
        _incremental_pending.pop(session_id, None)
        _incremental_start_time.pop(session_id, None)
