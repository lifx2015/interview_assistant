import base64
import json
import os
import time

import aiosqlite

from backend.config import settings

_db: aiosqlite.Connection | None = None

CREATE_INTERVIEWS_TABLE = """
CREATE TABLE IF NOT EXISTS interviews (
    session_id     TEXT PRIMARY KEY,
    candidate      TEXT NOT NULL,
    candidate_name TEXT NOT NULL,
    resume_text    TEXT NOT NULL DEFAULT '',
    qa_history     TEXT NOT NULL DEFAULT '[]',
    transcript     TEXT NOT NULL DEFAULT '[]',
    analysis_raw   TEXT NOT NULL DEFAULT '',
    evaluation_raw TEXT NOT NULL DEFAULT '',
    questions_raw  TEXT NOT NULL DEFAULT '',
    notes          TEXT NOT NULL DEFAULT '',
    pdf_content    BLOB,
    pdf_filename   TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
)
"""

CREATE_QUESTION_BANKS_TABLE = """
CREATE TABLE IF NOT EXISTS question_banks (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
"""

CREATE_QUESTIONS_TABLE = """
CREATE TABLE IF NOT EXISTS questions (
    id          TEXT PRIMARY KEY,
    bank_id     TEXT NOT NULL,
    content     TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT '',
    difficulty  TEXT NOT NULL DEFAULT 'medium',
    FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
)
"""

CREATE_VOICEPRINTS_TABLE = """
CREATE TABLE IF NOT EXISTS voiceprints (
    voice_id      TEXT PRIMARY KEY,
    role          TEXT NOT NULL DEFAULT 'interviewer',
    name          TEXT NOT NULL,
    session_id    TEXT NOT NULL,
    audio_file    TEXT NOT NULL,
    embedding     TEXT NOT NULL DEFAULT '[]',
    provider      TEXT NOT NULL DEFAULT 'unknown',
    sample_duration REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)
"""

CREATE_JOB_REQUIREMENTS_TABLE = """
CREATE TABLE IF NOT EXISTS job_requirements (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
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
        await _db.execute("PRAGMA foreign_keys = ON")
    return _db


async def init_db() -> None:
    db = await get_db()
    await db.execute(CREATE_INTERVIEWS_TABLE)
    await db.execute(CREATE_QUESTION_BANKS_TABLE)
    await db.execute(CREATE_QUESTIONS_TABLE)
    await db.execute(CREATE_VOICEPRINTS_TABLE)
    await db.execute(CREATE_JOB_REQUIREMENTS_TABLE)
    await db.commit()

    # Migration: add missing columns to interviews table
    cursor = await db.execute("PRAGMA table_info(interviews)")
    columns = [row[1] for row in await cursor.fetchall()]

    migrations = []
    if "questions_raw" not in columns:
        migrations.append("ALTER TABLE interviews ADD COLUMN questions_raw TEXT NOT NULL DEFAULT ''")
    if "resume_text" not in columns:
        migrations.append("ALTER TABLE interviews ADD COLUMN resume_text TEXT NOT NULL DEFAULT ''")
    if "pdf_content" not in columns:
        migrations.append("ALTER TABLE interviews ADD COLUMN pdf_content BLOB")
    if "pdf_filename" not in columns:
        migrations.append("ALTER TABLE interviews ADD COLUMN pdf_filename TEXT")
    if "evaluation_raw" not in columns:
        migrations.append("ALTER TABLE interviews ADD COLUMN evaluation_raw TEXT NOT NULL DEFAULT ''")

    for sql in migrations:
        await db.execute(sql)
    if migrations:
        await db.commit()

    # Migration: add missing columns to voiceprints table
    cursor = await db.execute("PRAGMA table_info(voiceprints)")
    vp_columns = [row[1] for row in await cursor.fetchall()]

    vp_migrations = []
    if "embedding" not in vp_columns:
        vp_migrations.append("ALTER TABLE voiceprints ADD COLUMN embedding TEXT NOT NULL DEFAULT '[]'")

    for sql in vp_migrations:
        await db.execute(sql)
    if vp_migrations:
        await db.commit()

    # Migrate question banks from JSON files to SQLite
    await _migrate_question_banks_from_files(db)
    # Migrate voiceprints from JSON file to SQLite
    await _migrate_voiceprints_from_file(db)


async def _migrate_question_banks_from_files(db: aiosqlite.Connection) -> None:
    """One-time migration: import existing JSON question bank files into SQLite."""
    from pathlib import Path
    bank_dir = Path("data/question_banks")
    if not bank_dir.exists():
        return

    # Check if any data already exists in the table
    cursor = await db.execute("SELECT COUNT(*) FROM question_banks")
    count = (await cursor.fetchone())[0]
    if count > 0:
        return  # Already migrated

    for file_path in bank_dir.glob("*.json"):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                bank = json.load(f)
            await db.execute(
                "INSERT OR IGNORE INTO question_banks (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (bank["id"], bank["name"], bank.get("description", ""), bank.get("created_at", ""), bank.get("updated_at", "")),
            )
            for q in bank.get("questions", []):
                await db.execute(
                    "INSERT OR IGNORE INTO questions (id, bank_id, content, category, difficulty) VALUES (?, ?, ?, ?, ?)",
                    (q["id"], bank["id"], q["content"], q.get("category", ""), q.get("difficulty", "medium")),
                )
        except Exception as e:
            print(f"Failed to migrate bank {file_path}: {e}")

    await db.commit()


async def _migrate_voiceprints_from_file(db: aiosqlite.Connection) -> None:
    """One-time migration: import existing voiceprints.json into SQLite."""
    from pathlib import Path
    vp_file = Path("data/voiceprints/voiceprints.json")
    if not vp_file.exists():
        return

    # Check if any data already exists
    cursor = await db.execute("SELECT COUNT(*) FROM voiceprints")
    count = (await cursor.fetchone())[0]
    if count > 0:
        return  # Already migrated

    try:
        with open(vp_file, 'r', encoding='utf-8') as f:
            voiceprints = json.load(f)
        for voice_id, vp in voiceprints.items():
            await db.execute(
                "INSERT OR IGNORE INTO voiceprints (voice_id, role, name, session_id, audio_file, provider, sample_duration) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (voice_id, vp.get("role", "interviewer"), vp.get("name", ""), vp.get("session_id", "global_interviewers"), vp.get("audio_file", ""), vp.get("provider", "unknown"), vp.get("sample_duration", 0)),
            )
        await db.commit()
    except Exception as e:
        print(f"Failed to migrate voiceprints: {e}")


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
                transcript, analysis_raw, evaluation_raw, questions_raw, notes,
                pdf_content, pdf_filename, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["session_id"],
                candidate_json,
                candidate_name,
                data.get("resume_text", ""),
                qa_history_json,
                transcript_json,
                data.get("analysis_raw", ""),
                data.get("evaluation_raw", ""),
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
                transcript, analysis_raw, evaluation_raw, questions_raw, notes,
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
                data.get("evaluation_raw", ""),
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
    # Convert BLOB to base64 string for JSON serialization
    if row.get("pdf_content") and isinstance(row["pdf_content"], bytes):
        row["pdf_content"] = base64.b64encode(row["pdf_content"]).decode("utf-8")
    return row


# ── Question Bank DB operations ──

async def list_question_banks() -> list[dict]:
    db = await get_db()
    rows = await db.execute_fetchall(
        """SELECT qb.id, qb.name, qb.description, qb.created_at, qb.updated_at,
                  (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id) AS question_count
           FROM question_banks qb ORDER BY qb.updated_at DESC"""
    )
    return [dict(row) for row in rows]


async def get_question_bank(bank_id: str) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall("SELECT * FROM question_banks WHERE id = ?", (bank_id,))
    if not rows:
        return None
    bank = dict(rows[0])
    q_rows = await db.execute_fetchall("SELECT * FROM questions WHERE bank_id = ?", (bank_id,))
    bank["questions"] = [dict(q) for q in q_rows]
    return bank


async def create_question_bank(bank_id: str, name: str, description: str = "") -> dict:
    db = await get_db()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    await db.execute(
        "INSERT INTO question_banks (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (bank_id, name, description, now, now),
    )
    await db.commit()
    return {"id": bank_id, "name": name, "description": description, "questions": [], "created_at": now, "updated_at": now}


async def update_question_bank(bank_id: str, name: str | None = None, description: str | None = None) -> dict | None:
    db = await get_db()
    bank = await get_question_bank(bank_id)
    if not bank:
        return None
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    if name is not None:
        await db.execute("UPDATE question_banks SET name = ?, updated_at = ? WHERE id = ?", (name, now, bank_id))
    if description is not None:
        await db.execute("UPDATE question_banks SET description = ?, updated_at = ? WHERE id = ?", (description, now, bank_id))
    await db.commit()
    return await get_question_bank(bank_id)


async def delete_question_bank(bank_id: str) -> bool:
    db = await get_db()
    await db.execute("DELETE FROM questions WHERE bank_id = ?", (bank_id,))
    cursor = await db.execute("DELETE FROM question_banks WHERE id = ?", (bank_id,))
    await db.commit()
    return cursor.rowcount > 0


async def add_question(question_id: str, bank_id: str, content: str, category: str = "", difficulty: str = "medium") -> dict:
    db = await get_db()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    await db.execute(
        "INSERT INTO questions (id, bank_id, content, category, difficulty) VALUES (?, ?, ?, ?, ?)",
        (question_id, bank_id, content, category, difficulty),
    )
    await db.execute("UPDATE question_banks SET updated_at = ? WHERE id = ?", (now, bank_id))
    await db.commit()
    return {"id": question_id, "bank_id": bank_id, "content": content, "category": category, "difficulty": difficulty}


async def delete_question(bank_id: str, question_id: str) -> bool:
    db = await get_db()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor = await db.execute("DELETE FROM questions WHERE id = ? AND bank_id = ?", (question_id, bank_id))
    await db.execute("UPDATE question_banks SET updated_at = ? WHERE id = ?", (now, bank_id))
    await db.commit()
    return cursor.rowcount > 0


async def update_question(bank_id: str, question_id: str, content: str | None = None, category: str | None = None, difficulty: str | None = None) -> bool:
    db = await get_db()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    if content is not None:
        await db.execute("UPDATE questions SET content = ? WHERE id = ? AND bank_id = ?", (content, question_id, bank_id))
    if category is not None:
        await db.execute("UPDATE questions SET category = ? WHERE id = ? AND bank_id = ?", (category, question_id, bank_id))
    if difficulty is not None:
        await db.execute("UPDATE questions SET difficulty = ? WHERE id = ? AND bank_id = ?", (difficulty, question_id, bank_id))
    await db.execute("UPDATE question_banks SET updated_at = ? WHERE id = ?", (now, bank_id))
    await db.commit()
    return True


async def import_questions(bank_id: str, questions: list[dict]) -> int:
    db = await get_db()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    for q in questions:
        await db.execute(
            "INSERT OR IGNORE INTO questions (id, bank_id, content, category, difficulty) VALUES (?, ?, ?, ?, ?)",
            (q["id"], bank_id, q["content"], q.get("category", ""), q.get("difficulty", "medium")),
        )
    await db.execute("UPDATE question_banks SET updated_at = ? WHERE id = ?", (now, bank_id))
    await db.commit()
    return len(questions)


# ── Voiceprint DB operations ──

async def list_voiceprints(session_id: str | None = None) -> list[dict]:
    db = await get_db()
    if session_id:
        rows = await db.execute_fetchall("SELECT * FROM voiceprints WHERE session_id = ?", (session_id,))
    else:
        rows = await db.execute_fetchall("SELECT * FROM voiceprints")
    return [dict(row) for row in rows]


async def save_voiceprint(voice_id: str, role: str, name: str, session_id: str, audio_file: str, embedding: list, provider: str, sample_duration: float) -> None:
    db = await get_db()
    embedding_json = json.dumps(embedding)
    await db.execute(
        """INSERT OR REPLACE INTO voiceprints (voice_id, role, name, session_id, audio_file, embedding, provider, sample_duration)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (voice_id, role, name, session_id, audio_file, embedding_json, provider, sample_duration),
    )
    await db.commit()


async def delete_voiceprint_db(voice_id: str) -> bool:
    db = await get_db()
    cursor = await db.execute("DELETE FROM voiceprints WHERE voice_id = ?", (voice_id,))
    await db.commit()
    return cursor.rowcount > 0


async def clear_voiceprints_db(session_id: str) -> int:
    db = await get_db()
    cursor = await db.execute("DELETE FROM voiceprints WHERE session_id = ?", (session_id,))
    await db.commit()
    return cursor.rowcount


# ── Job Requirement DB operations ──

async def list_job_requirements() -> list[dict]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT * FROM job_requirements ORDER BY updated_at DESC"
    )
    return [dict(row) for row in rows]


async def get_job_requirement(jr_id: str) -> dict | None:
    db = await get_db()
    rows = await db.execute_fetchall("SELECT * FROM job_requirements WHERE id = ?", (jr_id,))
    if not rows:
        return None
    return dict(rows[0])


async def create_job_requirement(jr_id: str, name: str, description: str = "") -> dict:
    db = await get_db()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    await db.execute(
        "INSERT INTO job_requirements (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (jr_id, name, description, now, now),
    )
    await db.commit()
    return {"id": jr_id, "name": name, "description": description, "created_at": now, "updated_at": now}


async def update_job_requirement(jr_id: str, name: str | None = None, description: str | None = None) -> dict | None:
    db = await get_db()
    existing = await get_job_requirement(jr_id)
    if not existing:
        return None
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    if name is not None:
        await db.execute("UPDATE job_requirements SET name = ?, updated_at = ? WHERE id = ?", (name, now, jr_id))
    if description is not None:
        await db.execute("UPDATE job_requirements SET description = ?, updated_at = ? WHERE id = ?", (description, now, jr_id))
    await db.commit()
    return await get_job_requirement(jr_id)


async def delete_job_requirement(jr_id: str) -> bool:
    db = await get_db()
    cursor = await db.execute("DELETE FROM job_requirements WHERE id = ?", (jr_id,))
    await db.commit()
    return cursor.rowcount > 0