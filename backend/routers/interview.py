from fastapi import APIRouter

from backend.routers.resume import get_sessions

router = APIRouter()


@router.get("/interview/{session_id}/history")
async def get_history(session_id: str):
    sessions = get_sessions()
    if session_id not in sessions:
        return {"error": "Session not found"}
    return sessions[session_id]["qa_history"]
