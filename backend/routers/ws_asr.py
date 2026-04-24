"""
WebSocket ASR route with voiceprint role switching and real-time follow-up analysis.
"""
import asyncio
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.routers.sessions import get_sessions
from backend.services.asr_service import ASRService
from backend.services.llm_service import incremental_analyze_stream, interview_evaluation_stream
from backend.services.voiceprint_service import voiceprint_service

router = APIRouter()
logger = logging.getLogger(__name__)


_incremental_in_flight: dict[str, bool] = {}
_incremental_pending: dict[str, str] = {}
_incremental_start_time: dict[str, float] = {}
_INCREMENTAL_TIMEOUT = 30.0


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

    current_role = "interviewer"
    interviewer_text: list[str] = []
    candidate_text: list[str] = []
    conversation_history: list[dict] = []
    current_question = ""

    has_candidate_spoken_this_round = False
    main_question = ""
    follow_up_questions: list[str] = []

    voiceprint_enabled = False
    recent_audio_chunks: list[bytes] = []
    VOICEPRINT_CHUNK_COUNT = 5
    voiceprint_hit_count = 0
    voiceprint_candidate_role: str | None = None
    VOICEPRINT_SWITCH_THRESHOLD = 3

    job_requirement: dict | None = None

    _last_analysis_time = 0.0
    _last_analysis_accumulated = 0
    _ANALYSIS_MIN_SENTENCE_LEN = 30
    _ANALYSIS_ACCUMULATED_INTERVAL = 150
    _ANALYSIS_TIME_GAP = 15.0

    def reset_voiceprint_state(clear_chunks: bool = True):
        nonlocal voiceprint_hit_count, voiceprint_candidate_role, recent_audio_chunks
        voiceprint_hit_count = 0
        voiceprint_candidate_role = None
        if clear_chunks:
            recent_audio_chunks = []

    def reset_round_state():
        nonlocal has_candidate_spoken_this_round
        nonlocal main_question
        nonlocal follow_up_questions
        nonlocal current_question
        nonlocal _last_analysis_time
        nonlocal _last_analysis_accumulated
        has_candidate_spoken_this_round = False
        main_question = ""
        follow_up_questions = []
        current_question = ""
        _last_analysis_time = 0.0
        _last_analysis_accumulated = 0
        reset_voiceprint_state()

    def on_partial(text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            result_queue.put(
                {
                    "type": "partial",
                    "text": text,
                    "sentence_id": sentence_id,
                    "role": current_role,
                }
            ),
            loop,
        )

    def on_sentence(text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            result_queue.put(
                {
                    "type": "sentence",
                    "text": text,
                    "sentence_id": sentence_id,
                    "role": current_role,
                }
            ),
            loop,
        )

    def on_error(msg: str):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({"type": "error", "data": msg}),
            loop,
        )

    asr_started = False

    async def check_voiceprint_and_switch(audio_data: bytes):
        nonlocal current_role, voiceprint_hit_count, voiceprint_candidate_role

        if not voiceprint_enabled:
            return

        voiceprints = await voiceprint_service.get_global_voiceprints()
        if not voiceprints:
            return

        try:
            result = voiceprint_service.identify_speaker(audio_data=audio_data, threshold=0.5)
        except Exception as e:
            logger.exception("Voiceprint identification failed")
            await websocket.send_json(
                {"type": "error", "data": f"Voiceprint identification failed: {str(e)}"}
            )
            reset_voiceprint_state()
            return

        detected_role = result.get("role", "candidate")
        confidence = result.get("confidence", 0.0)

        if detected_role == "unknown":
            logger.warning("Voiceprint returned unknown role: %s", result)
            return

        if confidence < 0.6:
            return

        if detected_role == current_role:
            reset_voiceprint_state(clear_chunks=False)
            return

        if detected_role == voiceprint_candidate_role:
            voiceprint_hit_count += 1
        else:
            voiceprint_candidate_role = detected_role
            voiceprint_hit_count = 1

        if voiceprint_hit_count < VOICEPRINT_SWITCH_THRESHOLD:
            return

        logger.info(
            "[Voiceprint] Stabilized role change: %s -> %s (confidence=%.2f, hits=%d)",
            current_role,
            detected_role,
            confidence,
            voiceprint_hit_count,
        )
        current_role = detected_role
        reset_voiceprint_state(clear_chunks=False)
        await websocket.send_json(
            {
                "type": "role_switched",
                "role": current_role,
                "detected_by": "voiceprint",
                "confidence": confidence,
                "cached": result.get("cached", False),
            }
        )

    async def run_incremental_analysis(sentence: str):
        if _incremental_in_flight.get(session_id):
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

        question_context = current_question
        if follow_up_questions:
            question_context += "\n[追问] " + " ".join(follow_up_questions[-3:])
        if not question_context.strip():
            fallback_answer = accumulated[-300:] if accumulated else sentence
            question_context = f"[当前问题上下文缺失]\n[候选人当前回答片段] {fallback_answer}"

        try:
            async for chunk in incremental_analyze_stream(
                resume_context=resume_ctx,
                current_sentence=sentence,
                accumulated_answer=accumulated,
                current_question=question_context,
                conversation_history=conversation_history,
            ):
                await websocket.send_json({"type": "follow_up_stream", "data": chunk})

            await websocket.send_json({"type": "follow_up_complete"})
        except Exception as e:
            logger.exception("Incremental analysis failed")
            await websocket.send_json(
                {"type": "error", "data": f"Incremental analysis failed: {str(e)}"}
            )

    try:
        async def forward_results():
            nonlocal has_candidate_spoken_this_round
            nonlocal main_question
            nonlocal current_question
            nonlocal follow_up_questions
            nonlocal _last_analysis_time
            nonlocal _last_analysis_accumulated

            while True:
                item = await result_queue.get()
                if item["type"] == "error":
                    await websocket.send_json(item)
                    continue

                await websocket.send_json(item)
                if item["type"] != "sentence":
                    continue

                if item["role"] == "interviewer":
                    interviewer_text.append(item["text"])
                    if has_candidate_spoken_this_round:
                        follow_up_questions.append(item["text"])
                    else:
                        main_question += item["text"]
                    current_question = main_question
                    continue

                candidate_text.append(item["text"])
                has_candidate_spoken_this_round = True

                accumulated_len = sum(len(s) for s in candidate_text)
                now = time.monotonic()
                time_since_last = now - _last_analysis_time if _last_analysis_time > 0 else float("inf")
                len_since_last = accumulated_len - _last_analysis_accumulated

                should_trigger = False
                if len(item["text"]) >= _ANALYSIS_MIN_SENTENCE_LEN:
                    should_trigger = True
                elif len_since_last >= _ANALYSIS_ACCUMULATED_INTERVAL:
                    should_trigger = True
                elif time_since_last >= _ANALYSIS_TIME_GAP and accumulated_len > 50:
                    should_trigger = True

                logger.info(
                    "[IncrementalAnalysis] role=%s sentence_len=%d accumulated_len=%d should_trigger=%s",
                    item["role"],
                    len(item["text"]),
                    accumulated_len,
                    should_trigger,
                )

                if should_trigger:
                    _last_analysis_time = now
                    _last_analysis_accumulated = accumulated_len
                    asyncio.create_task(run_incremental_analysis(item["text"]))

        forward_task = asyncio.create_task(forward_results())

        while True:
            raw = await websocket.receive()

            if "bytes" in raw and raw["bytes"]:
                audio_data = raw["bytes"]

                if voiceprint_enabled:
                    recent_audio_chunks.append(audio_data)
                    if len(recent_audio_chunks) >= VOICEPRINT_CHUNK_COUNT:
                        combined_audio = b"".join(recent_audio_chunks)
                        await check_voiceprint_and_switch(combined_audio)
                        recent_audio_chunks = []

                if not asr_started:
                    asr.start(on_partial=on_partial, on_sentence=on_sentence, on_error=on_error)
                    asr_started = True
                asr.send_audio_data(audio_data)
                continue

            if "text" not in raw or not raw["text"]:
                continue

            msg = json.loads(raw["text"])
            if msg.get("type") != "control":
                continue

            action = msg.get("action", "")

            if action == "switch_role":
                current_role = msg.get("role", "interviewer")
                reset_voiceprint_state()
                await websocket.send_json(
                    {"type": "role_switched", "role": current_role, "detected_by": "manual"}
                )

            elif action == "enable_voiceprint":
                voiceprint_enabled = True
                reset_voiceprint_state()
                await websocket.send_json(
                    {"type": "voiceprint_status", "enabled": True, "message": "声纹识别已启用"}
                )

            elif action == "disable_voiceprint":
                voiceprint_enabled = False
                reset_voiceprint_state()
                await websocket.send_json(
                    {"type": "voiceprint_status", "enabled": False, "message": "声纹识别已禁用"}
                )

            elif action == "set_job_requirement":
                job_requirement = msg.get("job_requirement")

            elif action == "answer_complete":
                if asr_started:
                    asr.stop()
                    asr_started = False

                _incremental_in_flight.pop(session_id, None)
                _incremental_pending.pop(session_id, None)
                _incremental_start_time.pop(session_id, None)

                full_answer = "".join(candidate_text)
                full_question = "".join(interviewer_text)
                candidate_text.clear()
                interviewer_text.clear()
                reset_round_state()

                conversation_history.append({"question": full_question, "answer": full_answer})
                await websocket.send_json({"type": "follow_up_clear"})

                session["qa_history"].append({"question": full_question, "answer": full_answer})
                await websocket.send_json(
                    {
                        "type": "answer_complete_ack",
                        "question": full_question,
                        "answer": full_answer,
                    }
                )

            elif action == "pause":
                if asr_started:
                    asr.stop()
                    asr_started = False

            elif action == "resume":
                if not asr_started:
                    asr.start(on_partial=on_partial, on_sentence=on_sentence, on_error=on_error)
                    asr_started = True

            elif action == "stop":
                if asr_started:
                    asr.stop()
                    asr_started = False

                reset_voiceprint_state()
                _incremental_in_flight.pop(session_id, None)
                _incremental_pending.pop(session_id, None)
                _incremental_start_time.pop(session_id, None)

                resume_ctx = session.get("resume_text", "")
                qa = session.get("qa_history", [])

                if qa:
                    await websocket.send_json({"type": "evaluation_start"})
                    async for chunk in interview_evaluation_stream(
                        resume_context=resume_ctx,
                        qa_history=qa,
                        job_requirement=job_requirement,
                    ):
                        await websocket.send_json({"type": "evaluation_stream", "data": chunk})
                    await websocket.send_json({"type": "evaluation_complete"})

                break

    except WebSocketDisconnect:
        pass
    finally:
        if asr_started:
            asr.stop()
        if "forward_task" in locals():
            forward_task.cancel()
        _incremental_in_flight.pop(session_id, None)
        _incremental_pending.pop(session_id, None)
        _incremental_start_time.pop(session_id, None)
