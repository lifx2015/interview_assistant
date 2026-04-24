# Shared in-memory session store
_sessions: dict[str, dict] = {
    "test-session-001": {
        "resume_text": "",
        "qa_history": [],
    }
}


def get_sessions() -> dict[str, dict]:
    return _sessions
