import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.routers.sessions import get_sessions
from backend.services.asr_service import ASRService
from backend.services.llm_service import analyze_answer_stream

router = APIRouter()


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

    # Current speaker role, controlled by frontend
    current_role = "interviewer"

    # Accumulated sentences per role
    interviewer_text: list[str] = []
    candidate_text: list[str] = []

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
                    else:
                        candidate_text.append(item["text"])

        forward_task = asyncio.create_task(forward_results())

        while True:
            raw = await websocket.receive()

            if "bytes" in raw and raw["bytes"]:
                audio_data = raw["bytes"]
                if not asr_started:
                    asr.start(on_partial=on_partial, on_sentence=on_sentence, on_error=on_error)
                    asr_started = True
                asr.send_audio(audio_data)

            elif "text" in raw and raw["text"]:
                msg = json.loads(raw["text"])

                if msg.get("type") == "control":
                    action = msg.get("action", "")

                    if action == "switch_role":
                        # Switch speaker role
                        new_role = msg.get("role", "interviewer")
                        current_role = new_role
                        await websocket.send_json({
                            "type": "role_switched",
                            "role": current_role,
                        })

                    elif action == "answer_complete":
                        # Stop ASR, run LLM analysis on candidate's answer
                        if asr_started:
                            asr.stop()
                            asr_started = False

                        full_answer = "".join(candidate_text)
                        full_question = "".join(interviewer_text)
                        candidate_text.clear()
                        interviewer_text.clear()

                        resume_ctx = session.get("resume_text", "")

                        # Stream LLM analysis
                        analysis_chunks: list[str] = []
                        async for chunk in analyze_answer_stream(
                            resume_context=resume_ctx,
                            question=full_question,
                            answer=full_answer,
                        ):
                            analysis_chunks.append(chunk)
                            await websocket.send_json({
                                "type": "analysis_stream",
                                "data": chunk,
                            })

                        full_analysis = "".join(analysis_chunks)
                        await websocket.send_json({
                            "type": "analysis_complete",
                            "data": full_analysis,
                            "question": full_question,
                            "answer": full_answer,
                        })

                        session["qa_history"].append({
                            "question": full_question,
                            "answer": full_answer,
                            "analysis": full_analysis,
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
                        break

    except WebSocketDisconnect:
        pass
    finally:
        if asr_started:
            asr.stop()
        forward_task.cancel()
