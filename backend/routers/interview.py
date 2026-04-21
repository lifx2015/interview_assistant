from fastapi import APIRouter, HTTPException

from backend.models.schemas import SaveInterviewRequest, InterviewListItem
from backend.routers.sessions import get_sessions
from backend.services.llm_service import generate_interview_questions
from backend.services import database

router = APIRouter()


@router.get("/interview/{session_id}/history")
async def get_history(session_id: str):
    sessions = get_sessions()
    if session_id not in sessions:
        return {"error": "Session not found"}
    return sessions[session_id]["qa_history"]


@router.post("/interview/{session_id}/generate-questions")
async def generate_questions(session_id: str):
    sessions = get_sessions()
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")

    session = sessions[session_id]
    resume_ctx = session.get("resume_text", "")
    candidate = session.get("candidate", {})
    risk_points = candidate.get("risk_points", [])

    result = await generate_interview_questions(resume_ctx, risk_points)
    session["generated_questions"] = result.get("questions", [])
    return result


@router.post("/interview/save")
async def save_interview(req: SaveInterviewRequest):
    sessions = get_sessions()
    existing = sessions.get(req.session_id, {})

    pdf_content = existing.get("pdf_content")
    pdf_filename = existing.get("pdf_filename")

    await database.save_interview({
        "session_id": req.session_id,
        "candidate": req.candidate,
        "resume_text": req.resume_text or existing.get("resume_text", ""),
        "qa_history": req.qa_history,
        "transcript": req.transcript,
        "analysis": req.analysis,
        "analysis_raw": req.analysis_raw,
        "questions": req.questions,
        "notes": req.notes,
        "pdf_content": pdf_content,
        "pdf_filename": pdf_filename,
    })
    return {"status": "ok"}


@router.get("/interview/list")
async def list_interviews():
    rows = await database.list_interviews()
    return [InterviewListItem(**row).model_dump() for row in rows]


@router.get("/interview/{session_id}/load")
async def load_interview(session_id: str):
    data = await database.load_interview(session_id)
    if not data:
        raise HTTPException(404, "Interview not found")

    # Restore into in-memory session so existing endpoints (e.g. PDF) work
    sessions = get_sessions()
    sessions[session_id] = {
        "resume_text": data.get("resume_text", ""),
        "candidate": data["candidate"],
        "qa_history": data.get("qa_history", []),
        "pdf_content": data.get("pdf_content"),
        "pdf_filename": data.get("pdf_filename"),
        "generated_questions": data.get("questions", []),
    }

    # Don't return pdf_content (binary) in JSON response
    data.pop("pdf_content", None)
    return data
