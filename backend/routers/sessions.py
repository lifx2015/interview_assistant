import time

# Shared in-memory session store
_sessions: dict[str, dict] = {}

SESSION_TTL = 3600  # 1 hour


def ensure_session(session_id: str) -> dict:
    """Get or create a session, guaranteeing it exists."""
    _cleanup_expired()
    if session_id not in _sessions:
        _sessions[session_id] = {
            "resume_text": "",
            "candidate": None,
            "qa_history": [],
            "_last_access": time.time(),
        }
    return _sessions[session_id]


def get_sessions() -> dict[str, dict]:
    _cleanup_expired()
    return _sessions


def _cleanup_expired() -> None:
    now = time.time()
    expired = [
        sid for sid, s in _sessions.items()
        if now - s.get("_last_access", now) > SESSION_TTL
    ]
    for sid in expired:
        del _sessions[sid]


def touch_session(session_id: str) -> None:
    if session_id in _sessions:
        _sessions[session_id]["_last_access"] = time.time()
