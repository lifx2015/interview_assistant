import os
import uuid
from urllib.parse import quote

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response

from backend.models.schemas import ResumeUploadResponse, CandidateInfo
from backend.services.resume_parser import parse_resume
from backend.services.llm_service import extract_resume_info
from backend.routers.sessions import get_sessions

router = APIRouter()


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
    sessions = get_sessions()
    sessions[session_id] = {
        "resume_text": raw_text,
        "candidate": candidate.model_dump(),
        "qa_history": [],
        "pdf_content": content if suffix == ".pdf" else None,
        "pdf_filename": file.filename,
    }

    return ResumeUploadResponse(session_id=session_id, candidate=candidate)


@router.get("/resume/{session_id}/pdf")
async def get_resume_pdf(session_id: str):
    sessions = get_sessions()
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    session = sessions[session_id]
    if not session.get("pdf_content"):
        raise HTTPException(404, "No PDF available for this session")

    filename = session.get("pdf_filename", "resume.pdf")
    encoded_filename = quote(filename)
    return Response(
        content=session["pdf_content"],
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}"
        },
    )
