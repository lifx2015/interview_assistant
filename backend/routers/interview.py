from fastapi import APIRouter, HTTPException

from backend.routers.sessions import get_sessions
from backend.services.llm_service import generate_interview_questions

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
