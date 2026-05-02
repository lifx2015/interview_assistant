import json
import logging
import os

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional
from fastapi.responses import StreamingResponse

from backend.services.audio_transcription_service import (
    SUPPORTED_AUDIO_EXTENSIONS,
    MAX_AUDIO_SIZE,
    process_audio_upload,
)
from backend.routers.sessions import get_sessions, touch_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    session_id: Optional[str] = Query(None),
    job_requirement_name: str = Query(""),
    job_requirement_desc: str = Query(""),
):
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in SUPPORTED_AUDIO_EXTENSIONS:
        raise HTTPException(
            400,
            f"不支持的音频格式 {suffix}，请上传 {', '.join(sorted(SUPPORTED_AUDIO_EXTENSIONS))} 格式的文件",
        )

    content = await file.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(400, f"文件过大（最大 {MAX_AUDIO_SIZE // (1024*1024)}MB）")

    sessions = get_sessions()

    # Resolve session context
    resume_context = None
    job_requirement = None
    if session_id and session_id in sessions:
        touch_session(session_id)
        session = sessions[session_id]
        resume_context = session.get("resume_text", "") or None
    else:
        session_id = None  # Will create new session

    if job_requirement_name or job_requirement_desc:
        job_requirement = {
            "name": job_requirement_name,
            "description": job_requirement_desc,
        }

    async def event_stream():
        async for event in process_audio_upload(
            file_content=content,
            filename=file.filename or "audio.wav",
            session_id=session_id,
            resume_context=resume_context,
            job_requirement=job_requirement,
            sessions=sessions,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
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
