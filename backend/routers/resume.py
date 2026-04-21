import os
import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException

from backend.models.schemas import ResumeUploadResponse, CandidateInfo
from backend.services.resume_parser import parse_resume
from backend.services.llm_service import extract_resume_info

router = APIRouter()

# In-memory session store (production would use Redis/DB)
_sessions: dict[str, dict] = {}


def get_sessions() -> dict[str, dict]:
    return _sessions


@router.post("/resume/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in (".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"):
        raise HTTPException(400, "Unsupported file format. Use PDF/Word/Image.")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB).")

    raw_text = parse_resume(content, suffix)
    if not raw_text.strip():
        raise HTTPException(400, "Could not extract text from file.")

    candidate = await extract_resume_info(raw_text)
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "resume_text": raw_text,
        "candidate": candidate.model_dump(),
        "qa_history": [],
    }

    return ResumeUploadResponse(session_id=session_id, candidate=candidate)
