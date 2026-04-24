"""
WebSocket ASR route with voiceprint-based role detection and real-time follow-up analysis.
"""
import asyncio
import json
import logging
import time
import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.routers.sessions import get_sessions
from backend.services.asr_service import ASRService
from backend.services.llm_service import (
    incremental_analyze_stream,
    interview_evaluation_stream,
    psychology_analyze_stream,
)
from backend.services.voiceprint_service import voiceprint_service

router = APIRouter()
logger = logging.getLogger(__name__)

# 声纹识别用独立线程池，完全不阻塞 asyncio 事件循环
_voiceprint_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="voiceprint")


_incremental_in_flight: dict[str, bool] = {}
_incremental_pending: dict[str, str] = {}
_incremental_start_time: dict[str, float] = {}
_INCREMENTAL_TIMEOUT = 30.0


@router.websocket("/ws/asr/{session_id}")
async def asr_websocket(websocket: WebSocket, session_id: str):
    try:
        await websocket.accept()
        logger.info("[WebSocket] Connected: session_id=%s", session_id)
    except Exception as e:
        logger.error("[WebSocket] Failed to accept: %s", e)
        return

    sessions = get_sessions()
    if session_id not in sessions:
        await websocket.send_json({"type": "error", "data": "Invalid session"})
        await websocket.close()
        return

    session = sessions[session_id]
    asr = ASRService()
    result_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    current_role = "candidate"  # 默认为候选人，只有识别到面试官声纹才切换
    interviewer_text: list[str] = []
    candidate_text: list[str] = []
    conversation_history: list[dict] = []
    current_question = ""

    has_candidate_spoken_this_round = False
    main_question = ""
    follow_up_questions: list[str] = []

    # 声纹识别队列：存储未确认角色的句子
    pending_sentences: list[dict] = []  # [{text, sentence_id, timestamp}]
    _voiceprint_identifying = False  # 是否正在声纹识别

    # 声纹已在服务启动时加载，直接检查状态
    try:
        voiceprints = await voiceprint_service.get_global_voiceprints()
        voiceprint_enabled = len(voiceprints) > 0
        logger.info("[Voiceprint] Check: registered=%d, enabled=%s", len(voiceprints), voiceprint_enabled)

        if voiceprint_enabled:
            await websocket.send_json({
                "type": "voiceprint_status",
                "enabled": True,
                "message": f"声纹识别已启用（已注册 {len(voiceprints)} 个面试官声纹）"
            })
        else:
            await websocket.send_json({
                "type": "voiceprint_status",
                "enabled": False,
                "message": "请先在声纹管理页面注册面试官声纹"
            })
    except Exception as e:
        logger.error("[Voiceprint] Check failed: %s", e)
        voiceprint_enabled = False

    recent_audio_chunks: list[bytes] = []
    voiceprint_accumulated_bytes = 0
    VOICEPRINT_MIN_BYTES = 48000  # 1.5秒音频才触发（平衡速度和准确度）
    INTERVIEWER_CONFIDENCE_THRESHOLD = 0.75

    job_requirement: dict | None = None

    _last_analysis_time = 0.0
    _last_analysis_accumulated = 0
    _ANALYSIS_MIN_SENTENCE_LEN = 30
    _ANALYSIS_ACCUMULATED_INTERVAL = 150
    _ANALYSIS_TIME_GAP = 15.0

    _psychology_in_flight = False
    _psychology_trigger_count = 0
    _PSYCHOLOGY_TRIGGER_INTERVAL = 3

    def reset_voiceprint_state(clear_chunks: bool = True):
        nonlocal recent_audio_chunks, voiceprint_accumulated_bytes
        voiceprint_accumulated_bytes = 0
        if clear_chunks:
            recent_audio_chunks = []

    def reset_round_state():
        nonlocal has_candidate_spoken_this_round
        nonlocal main_question
        nonlocal follow_up_questions
        nonlocal current_question
        nonlocal _last_analysis_time
        nonlocal _last_analysis_accumulated
        nonlocal _psychology_trigger_count
        has_candidate_spoken_this_round = False
        main_question = ""
        follow_up_questions = []
        current_question = ""
        _last_analysis_time = 0.0
        _last_analysis_accumulated = 0
        _psychology_trigger_count = 0
        reset_voiceprint_state()

    def on_partial(text: str, sentence_id: int):
        partial_time = time.monotonic()
        logger.debug("[TIMING] on_partial callback: text_len=%d, time=%.3f", len(text), partial_time)
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
        sentence_time = time.monotonic()
        logger.info("[TIMING] on_sentence: text='%s' time=%.3f, voiceprint_identifying=%s",
                    text[:50] if text else "", sentence_time, _voiceprint_identifying)

        # 加入待确认队列
        pending_sentences.append({
            "text": text,
            "sentence_id": sentence_id,
            "timestamp": sentence_time,
        })

        # 发送 pending 状态给前端
        asyncio.run_coroutine_threadsafe(
            result_queue.put({
                "type": "sentence_pending",
                "text": text,
                "sentence_id": sentence_id,
            }),
            loop,
        )

    def on_error(msg: str):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({"type": "error", "data": msg}),
            loop,
        )

    asr_started = False

    async def run_voiceprint_identification(audio_data: bytes):
        """在独立线程中执行声纹识别，完成后确认所有 pending 句子"""
        nonlocal current_role, _voiceprint_identifying, pending_sentences
        logger.info("[VOICEPRINT-TASK] START audio_len=%d, pending_sentences=%d",
                    len(audio_data), len(pending_sentences))
        _voiceprint_identifying = True

        def do_identification():
            logger.info("[VOICEPRINT-THREAD] Running identification...")
            try:
                result = voiceprint_service.identify_speaker(audio_data=audio_data, threshold=0.75)
                logger.info("[VOICEPRINT-THREAD] Result: matched=%s role=%s confidence=%.2f",
                            result.get("matched"), result.get("role"), result.get("confidence", 0))
                return result
            except Exception as e:
                logger.error("[VOICEPRINT-THREAD] FAILED: %s", e)
                return None

        try:
            result = await asyncio.get_running_loop().run_in_executor(_voiceprint_executor, do_identification)
        except Exception as e:
            logger.error("[VOICEPRINT-TASK] Executor failed: %s", e)
            _voiceprint_identifying = False
            return

        if result is None:
            logger.warning("[VOICEPRINT-TASK] No result, using current_role=%s", current_role)
        else:
            matched = bool(result.get("matched"))
            confidence = float(result.get("confidence", 0.0) or 0.0)

            if matched and result.get("role") == "interviewer" and confidence >= INTERVIEWER_CONFIDENCE_THRESHOLD:
                new_role = "interviewer"
            else:
                new_role = "candidate"

            if new_role != current_role:
                logger.info("[VOICEPRINT-TASK] ROLE CHANGE: %s -> %s", current_role, new_role)
                current_role = new_role
                await websocket.send_json({
                    "type": "role_switched",
                    "role": current_role,
                    "detected_by": "voiceprint",
                    "confidence": confidence,
                })

        # 确认所有 pending 句子的角色
        confirmed_role = current_role
        logger.info("[VOICEPRINT-TASK] Confirming %d pending sentences as role=%s",
                    len(pending_sentences), confirmed_role)

        for sent in pending_sentences:
            await websocket.send_json({
                "type": "sentence_confirmed",
                "text": sent["text"],
                "sentence_id": sent["sentence_id"],
                "role": confirmed_role,
            })

        pending_sentences.clear()
        _voiceprint_identifying = False
        logger.info("[VOICEPRINT-TASK] END")

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
            await websocket.send_json({"type": "error", "data": f"Incremental analysis failed: {str(e)}"})

    async def run_psychology_analysis(sentence: str):
        nonlocal _psychology_in_flight
        if _psychology_in_flight:
            return
        _psychology_in_flight = True
        try:
            accumulated = "".join(candidate_text)
            resume_ctx = session.get("resume_text", "")

            question_context = current_question
            if follow_up_questions:
                question_context += "\n[追问] " + " ".join(follow_up_questions[-3:])

            await websocket.send_json({"type": "psychology_start"})
            async for chunk in psychology_analyze_stream(
                resume_context=resume_ctx,
                current_question=question_context,
                recent_sentences=sentence,
                accumulated_answer=accumulated,
            ):
                await websocket.send_json({"type": "psychology_stream", "data": chunk})
            await websocket.send_json({"type": "psychology_complete"})
        except Exception:
            logger.exception("Psychology analysis failed")
        finally:
            _psychology_in_flight = False

    try:
        async def forward_results():
            nonlocal has_candidate_spoken_this_round
            nonlocal main_question
            nonlocal current_question
            nonlocal follow_up_questions
            nonlocal _last_analysis_time
            nonlocal _last_analysis_accumulated
            nonlocal _psychology_trigger_count

            logger.info("[FORWARD] Task started")
            try:
                while True:
                    item = await result_queue.get()
                    forward_time = time.monotonic()
                    logger.debug("[TIMING] forward_results: type=%s role=%s time=%.3f", item["type"], item.get("role"), forward_time)

                    # 直接发送，不暂存
                    if item["type"] == "error":
                        await websocket.send_json(item)
                        continue

                    await websocket.send_json(item)
                    send_time = time.monotonic() - forward_time
                    logger.debug("[TIMING] websocket.send_json took %.3fms", send_time * 1000)

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

                    if should_trigger:
                        _last_analysis_time = now
                        _last_analysis_accumulated = accumulated_len
                        asyncio.create_task(run_incremental_analysis(item["text"]))

                        _psychology_trigger_count += 1
                        if _psychology_trigger_count >= _PSYCHOLOGY_TRIGGER_INTERVAL:
                            _psychology_trigger_count = 0
                            asyncio.create_task(run_psychology_analysis(item["text"]))
            except asyncio.CancelledError:
                logger.info("[ForwardResults] Task cancelled")
            except Exception as e:
                logger.error("[ForwardResults] Task error: %s", e)

        forward_task = asyncio.create_task(forward_results())
        logger.info("[WebSocket] Starting main loop for session %s", session_id)

        while True:
            try:
                raw = await websocket.receive()
                logger.debug("[WebSocket] Received raw message type: %s", list(raw.keys()))
            except Exception as e:
                logger.error("[WebSocket] Error receiving message: %s", e)
                break

            if "bytes" in raw and raw["bytes"]:
                audio_data = raw["bytes"]
                audio_len = len(audio_data)
                recv_time = time.monotonic()
                logger.debug("[TIMING] recv audio: len=%d, time=%.3f", audio_len, recv_time)

                # ASR 立即处理，完全独立于声纹识别
                if not asr_started:
                    try:
                        asr.start(on_partial=on_partial, on_sentence=on_sentence, on_error=on_error)
                        asr_started = True
                        logger.info("[ASR] Started")
                    except Exception as e:
                        logger.error("[ASR] Failed to start: %s", e)
                try:
                    asr_send_start = time.monotonic()
                    asr.send_audio_data(audio_data)
                    asr_send_time = time.monotonic() - asr_send_start
                    logger.debug("[TIMING] asr.send took %.3fms", asr_send_time * 1000)
                except Exception as e:
                    logger.error("[ASR] Failed to send: %s", e)

                # 声纹识别持续运行，可以动态切换角色
                if voiceprint_enabled:
                    recent_audio_chunks.append(audio_data)
                    voiceprint_accumulated_bytes += audio_len

                    # 累积够音频就触发识别
                    if voiceprint_accumulated_bytes >= VOICEPRINT_MIN_BYTES:
                        combined_audio = b"".join(recent_audio_chunks)
                        logger.info("[VOICEPRINT] Trigger with %.1fs audio, current_role=%s",
                                    voiceprint_accumulated_bytes / 32000, current_role)
                        asyncio.create_task(run_voiceprint_identification(combined_audio))
                        recent_audio_chunks = []
                        voiceprint_accumulated_bytes = 0

                continue

            if "text" not in raw or not raw["text"]:
                continue

            msg = json.loads(raw["text"])
            if msg.get("type") != "control":
                continue

            action = msg.get("action", "")

            if action == "set_job_requirement":
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
        logger.debug("[WebSocket] Client disconnected normally")
    except RuntimeError as e:
        if "disconnect" in str(e).lower():
            logger.error("[WebSocket] Connection closed: %s", e)
        else:
            logger.error("[WebSocket] Unexpected RuntimeError: %s", e)
    finally:
        if asr_started:
            asr.stop()
        if "forward_task" in locals():
            forward_task.cancel()
        _incremental_in_flight.pop(session_id, None)
        _incremental_pending.pop(session_id, None)
        _incremental_start_time.pop(session_id, None)
