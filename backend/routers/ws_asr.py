import asyncio
import json
import base64

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.routers.resume import get_sessions
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

    def on_partial(text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({"type": "partial", "text": text, "sentence_id": sentence_id}),
            loop,
        )

    def on_sentence(text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({"type": "sentence", "text": text, "sentence_id": sentence_id}),
            loop,
        )

    def on_error(msg: str):
        asyncio.run_coroutine_threadsafe(
            result_queue.put({"type": "error", "data": msg}),
            loop,
        )

    asr_started = False
    accumulated_sentences: list[str] = []

    try:
        # Task: forward ASR results to client
        async def forward_results():
            while True:
                item = await result_queue.get()
                if item["type"] == "error":
                    await websocket.send_json(item)
                    continue
                await websocket.send_json(item)
                if item["type"] == "sentence":
                    accumulated_sentences.append(item["text"])

        forward_task = asyncio.create_task(forward_results())

        # Main loop: receive audio or control messages from client
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
                    if action == "answer_complete":
                        # Stop ASR, run LLM analysis
                        if asr_started:
                            asr.stop()
                            asr_started = False

                        full_answer = "".join(accumulated_sentences)
                        accumulated_sentences.clear()

                        resume_ctx = session.get("resume_text", "")
                        qa_history = session.get("qa_history", [])
                        last_question = qa_history[-1]["question"] if qa_history else ""

                        # Stream LLM analysis
                        analysis_chunks: list[str] = []
                        async for chunk in analyze_answer_stream(
                            resume_context=resume_ctx,
                            question=last_question,
                            answer=full_answer,
                        ):
                            analysis_chunks.append(chunk)
                            await websocket.send_json({
                                "type": "analysis_stream",
                                "data": chunk,
                            })

                        # Send complete analysis
                        full_analysis = "".join(analysis_chunks)
                        await websocket.send_json({
                            "type": "analysis_complete",
                            "data": full_analysis,
                        })

                        # Save to session history
                        session["qa_history"].append({
                            "question": last_question,
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
