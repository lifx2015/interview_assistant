"""
面试题库管理 API 路由 — SQLite 后端
"""
import time
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import database

router = APIRouter(prefix="/question-bank", tags=["question-bank"])


class Question(BaseModel):
    id: str
    content: str
    category: Optional[str] = None
    difficulty: Optional[str] = None


class QuestionBank(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    questions: List[Question] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CreateBankRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateBankRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[Question]] = None


class AddQuestionRequest(BaseModel):
    content: str
    category: Optional[str] = None
    difficulty: Optional[str] = None


class ImportMarkdownRequest(BaseModel):
    markdown: str


def _parse_difficulty(diff_str: str) -> str:
    diff_map = {
        '简单': 'easy', '易': 'easy', 'easy': 'easy',
        '中等': 'medium', '中': 'medium', 'medium': 'medium',
        '困难': 'hard', '难': 'hard', 'hard': 'hard',
    }
    return diff_map.get(diff_str.lower(), 'medium')


def _parse_markdown_questions(markdown: str) -> List[dict]:
    """解析 Markdown 格式的题目列表"""
    import re

    questions = []
    current_category = ""

    category_pattern = r'^[#\s]*分类[:：]\s*(.+)$'

    lines = markdown.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        cat_match = re.match(category_pattern, line, re.IGNORECASE)
        if cat_match:
            current_category = cat_match.group(1).strip()
            i += 1
            continue

        title_match = re.match(r'^[#\s]*(?:题目\s*\d*)?\s*\[?难度[:：]?\s*(简单|中等|困难|easy|medium|hard)\]?', line, re.IGNORECASE)
        if title_match:
            difficulty = _parse_difficulty(title_match.group(1))
            i += 1
            content_lines = []
            while i < len(lines):
                next_line = lines[i].strip()
                if re.match(r'^[#\s]*(?:题目|分类)', next_line) or next_line.startswith('##') or next_line.startswith('###'):
                    break
                if next_line:
                    content_lines.append(next_line)
                i += 1

            if content_lines:
                questions.append({
                    'id': f"q_{int(time.time() * 1000)}_{len(questions)}",
                    'content': '\n'.join(content_lines).strip(),
                    'category': current_category,
                    'difficulty': difficulty,
                })
            continue

        simple_match = re.match(r'^[\d\-\*\+]+[\.\s]*(.+)$', line)
        if simple_match and len(simple_match.group(1)) > 5:
            content = simple_match.group(1).strip()
            questions.append({
                'id': f"q_{int(time.time() * 1000)}_{len(questions)}",
                'content': content,
                'category': current_category,
                'difficulty': 'medium',
            })

        i += 1

    if not questions and markdown.strip():
        questions.append({
            'id': f"q_{int(time.time() * 1000)}",
            'content': markdown.strip(),
            'category': current_category or "",
            'difficulty': 'medium',
        })

    return questions


@router.get("/list")
async def list_banks():
    banks = await database.list_question_banks()
    return {"banks": banks}


@router.post("/create")
async def create_bank(req: CreateBankRequest):
    bank_id = f"bank_{int(time.time() * 1000)}"
    bank = await database.create_question_bank(bank_id, req.name, req.description or "")
    return {"success": True, "bank": bank}


@router.get("/{bank_id}")
async def get_bank(bank_id: str):
    bank = await database.get_question_bank(bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    return bank


@router.put("/{bank_id}")
async def update_bank(bank_id: str, req: UpdateBankRequest):
    bank = await database.update_question_bank(bank_id, name=req.name, description=req.description)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")
    return {"success": True, "bank": bank}


@router.delete("/{bank_id}")
async def delete_bank(bank_id: str):
    success = await database.delete_question_bank(bank_id)
    if not success:
        raise HTTPException(status_code=404, detail="题库不存在")
    return {"success": True, "message": "题库已删除"}


@router.post("/{bank_id}/questions")
async def add_question(bank_id: str, req: AddQuestionRequest):
    bank = await database.get_question_bank(bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    question_id = f"q_{int(time.time() * 1000)}"
    question = await database.add_question(question_id, bank_id, req.content, req.category or "", req.difficulty or "medium")
    return {"success": True, "question": question}


@router.delete("/{bank_id}/questions/{question_id}")
async def delete_question(bank_id: str, question_id: str):
    success = await database.delete_question(bank_id, question_id)
    if not success:
        raise HTTPException(status_code=404, detail="题目不存在")
    return {"success": True, "message": "题目已删除"}


@router.put("/{bank_id}/questions/{question_id}")
async def update_question(bank_id: str, question_id: str, req: AddQuestionRequest):
    success = await database.update_question(bank_id, question_id, content=req.content, category=req.category, difficulty=req.difficulty)
    if not success:
        raise HTTPException(status_code=404, detail="题目不存在")
    return {"success": True, "message": "题目已更新"}


@router.post("/{bank_id}/import")
async def import_markdown(bank_id: str, req: ImportMarkdownRequest):
    bank = await database.get_question_bank(bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    questions = _parse_markdown_questions(req.markdown)
    if not questions:
        raise HTTPException(status_code=400, detail="未能从文本中解析出题目，请检查格式")

    imported = await database.import_questions(bank_id, questions)
    return {"success": True, "imported_count": imported, "questions": questions}
