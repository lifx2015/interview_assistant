import json
import os

import aiosqlite

from backend.config import settings

_db: aiosqlite.Connection | None = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS interviews (
    session_id     TEXT PRIMARY KEY,
    candidate      TEXT NOT NULL,
    candidate_name TEXT NOT NULL,
    resume_text    TEXT NOT NULL DEFAULT '',
    qa_history     TEXT NOT NULL DEFAULT '[]',
    transcript     TEXT NOT NULL DEFAULT '[]',
    analysis_raw   TEXT NOT NULL DEFAULT '',
    questions_raw  TEXT NOT NULL DEFAULT '',
    notes          TEXT NOT NULL DEFAULT '',
    pdf_content    BLOB,
    pdf_filename   TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
)
"""


def _get_db_path() -> str:
    path = settings.database_path
    db_dir = os.path.dirname(path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    return path


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await aiosqlite.connect(_get_db_path())
        _db.row_factory = aiosqlite.Row
    return _db


async def init_db() -> None:
    db = await get_db()
    await db.execute(CREATE_TABLE_SQL)
    await db.commit()


async def close_db() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None


async def save_interview(data: dict) -> None:
    db = await get_db()

    existing_row = await db.execute_fetchall(
        "SELECT created_at FROM interviews WHERE session_id = ?",
        (data["session_id"],),
    )
    created_at = existing_row[0]["created_at"] if existing_row else None

    candidate_json = json.dumps(data.get("candidate", {}), ensure_ascii=False)
    candidate_name = data.get("candidate", {}).get("name", "Unknown")
    qa_history_json = json.dumps(data.get("qa_history", []), ensure_ascii=False)
    transcript_json = json.dumps(data.get("transcript", []), ensure_ascii=False)

    if created_at:
        await db.execute(
            """INSERT OR REPLACE INTO interviews
               (session_id, candidate, candidate_name, resume_text, qa_history,
                transcript, analysis_raw, questions_raw, notes,
                pdf_content, pdf_filename, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["session_id"],
                candidate_json,
                candidate_name,
                data.get("resume_text", ""),
                qa_history_json,
                transcript_json,
                data.get("analysis_raw", ""),
                data.get("questions_raw", ""),
                data.get("notes", ""),
                data.get("pdf_content"),
                data.get("pdf_filename"),
                created_at,
            ),
        )
    else:
        await db.execute(
            """INSERT INTO interviews
               (session_id, candidate, candidate_name, resume_text, qa_history,
                transcript, analysis_raw, questions_raw, notes,
                pdf_content, pdf_filename)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["session_id"],
                candidate_json,
                candidate_name,
                data.get("resume_text", ""),
                qa_history_json,
                transcript_json,
                data.get("analysis_raw", ""),
                data.get("questions_raw", ""),
                data.get("notes", ""),
                data.get("pdf_content"),
                data.get("pdf_filename"),
            ),
        )
    await db.commit()


async def list_interviews() -> list[dict]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT session_id, candidate_name, created_at FROM interviews ORDER BY created_at DESC"
    )
    return [dict(row) for row in rows]


async def load_interview(session_id: str) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT * FROM interviews WHERE session_id = ?", (session_id,)
    )
    if not rows:
        return None
    row = dict(rows[0])
    row["candidate"] = json.loads(row["candidate"])
    row["qa_history"] = json.loads(row["qa_history"])
    row["transcript"] = json.loads(row["transcript"])
    return row
