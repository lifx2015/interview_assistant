# Shared in-memory session store
_sessions: dict[str, dict] = {}


def get_sessions() -> dict[str, dict]:
    return _sessions
