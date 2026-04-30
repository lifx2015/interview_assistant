import base64
import json
import logging
import os
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from backend.models.schemas import SaveInterviewRequest
from backend.routers.sessions import get_sessions, touch_session
from backend.services import database
from backend.services.llm_service import generate_interview_questions_stream

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interview", tags=["interview"])


@router.post("/save")
async def save_interview(req: SaveInterviewRequest):
    sessions = get_sessions()
    session = sessions.get(req.session_id, {})
    touch_session(req.session_id)

    pdf_content = session.get("pdf_content")
    pdf_filename = session.get("pdf_filename")
    recording_paths = session.get("recording_paths", [])

    await database.save_interview({
        "session_id": req.session_id,
        "candidate": req.candidate,
        "resume_text": req.resume_text,
        "qa_history": req.qa_history,
        "transcript": req.transcript,
        "analysis_raw": req.analysis_raw,
        "evaluation_raw": req.evaluation_raw,
        "questions_raw": req.questions_raw,
        "notes": req.notes,
        "pdf_content": pdf_content,
        "pdf_filename": pdf_filename,
        "recording_paths": recording_paths,
    })
    return {"status": "ok", "recording_paths": recording_paths}


@router.get("/list")
async def list_interviews():
    return await database.list_interviews()


@router.get("/{session_id}/load")
async def load_interview(session_id: str):
    data = await database.load_interview(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Interview not found")

    sessions = get_sessions()
    # Store raw PDF bytes in session so re-save writes correct BLOB
    pdf_bytes = data.get("pdf_content")
    sessions[session_id] = {
        "candidate": data["candidate"],
        "resume_text": data.get("resume_text", ""),
        "qa_history": data.get("qa_history", []),
        "pdf_content": pdf_bytes,
        "pdf_filename": data.get("pdf_filename"),
        "_last_access": time.time(),
    }
    touch_session(session_id)

    # Base64-encode for JSON response (raw bytes are not JSON-serializable)
    if pdf_bytes and isinstance(pdf_bytes, bytes):
        data["pdf_content"] = base64.b64encode(pdf_bytes).decode("utf-8")
    return data


@router.get("/{session_id}/recording")
async def get_recording(session_id: str):
    data = await database.load_interview(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Interview not found")

    recording_paths = data.get("recording_paths", [])
    if not recording_paths:
        raise HTTPException(status_code=404, detail="No recording available")

    wav_path = recording_paths[0]
    if not os.path.exists(wav_path):
        raise HTTPException(status_code=404, detail="Recording file not found on disk")

    filename = f"{session_id}_full.wav"
    return FileResponse(
        wav_path,
        media_type="audio/wav",
        filename=filename,
    )


@router.get("/{session_id}/generate-questions")
async def generate_questions(session_id: str):
    logger.info("[generate-questions] request received, session_id=%s", session_id)
    sessions = get_sessions()
    session = sessions.get(session_id)
    if not session:
        logger.error("[generate-questions] session not found: %s", session_id)
        raise HTTPException(status_code=404, detail="Session not found")
    touch_session(session_id)

    resume_ctx = session.get("resume_text", "")
    candidate = session.get("candidate", {})
    risk_points = candidate.get("risk_points", [])
    logger.info("[generate-questions] resume_ctx length=%d, risk_points=%s", len(resume_ctx), risk_points)

    async def event_stream():
        chunk_count = 0
        try:
            async for chunk in generate_interview_questions_stream(
                resume_context=resume_ctx,
                risk_points=risk_points,
            ):
                chunk_count += 1
                if chunk_count <= 3:
                    logger.info("[generate-questions] chunk %d: %s", chunk_count, chunk[:80])
                # SSE multi-line format: each line prefixed with "data:"
                lines = chunk.split('\n')
                for line in lines:
                    yield f"data: {line}\n"
                yield "\n"
            logger.info("[generate-questions] stream done, total chunks=%d", chunk_count)
        except Exception as e:
            logger.error("[generate-questions] stream error: %s", e, exc_info=True)
            yield f"data: [ERROR] {str(e)}\n\n"
            return
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
