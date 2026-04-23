import asyncio
import json
import logging

import dashscope
from dashscope import Generation

from backend.config import settings
from backend.models.schemas import CandidateInfo
from backend.prompts.star_analysis import (
    RESUME_EXTRACTION_PROMPT,
    STAR_ANALYSIS_PROMPT,
    INCREMENTAL_ANALYSIS_PROMPT,
    INTERVIEW_QUESTIONS_PROMPT,
)

logger = logging.getLogger(__name__)


dashscope.api_key = settings.dashscope_api_key


def _extract_json(content: str) -> dict:
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    return json.loads(content.strip())


def _compress_history(history: list[dict], keep_rounds: int = 3, exclude_last: bool = False) -> str:
    """Keep the last N full rounds; summarize older rounds into a brief block.
    If exclude_last is True, exclude the most recent round (it's passed as explicit params)."""
    if not history:
        return "暂无之前的对话"

    working = history[:-1] if exclude_last and len(history) > 1 else history

    if len(working) == 0:
        return "暂无之前的对话"

    if len(working) <= keep_rounds:
        lines = []
        for i, qa in enumerate(working, 1):
            lines.append(f"第{i}轮 - 面试官: {qa.get('question', '')}")
            lines.append(f"第{i}轮 - 候选人: {qa.get('answer', '')}")
        return "\n".join(lines)

    older = working[:-keep_rounds]
    recent = working[-keep_rounds:]

    older_summary = f"[前{len(older)}轮对话摘要] 共讨论了{len(older)}个问题，"
    topics = []
    for qa in older:
        q = qa.get("question", "")
        topics.append(q[:20] + "..." if len(q) > 20 else q)
    older_summary += "涉及：" + "；".join(topics)

    recent_lines = []
    for i, qa in enumerate(recent, len(older) + 1):
        recent_lines.append(f"第{i}轮 - 面试官: {qa.get('question', '')}")
        recent_lines.append(f"第{i}轮 - 候选人: {qa.get('answer', '')}")

    return older_summary + "\n\n" + "\n".join(recent_lines)


def _stream_llm(prompt: str):
    """Synchronous generator that yields incremental text chunks from LLM."""
    logger.info("[_stream_llm] starting, prompt length=%d", len(prompt))
    responses = Generation.call(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        result_format="message",
        stream=True,
        incremental_output=True,
    )
    count = 0
    for resp in responses:
        if resp.output and resp.output.choices:
            delta = resp.output.choices[0].message.content
            if delta:
                count += 1
                if count <= 3:
                    logger.info("[_stream_llm] chunk %d: %s", count, delta[:80])
                yield delta
    logger.info("[_stream_llm] done, total chunks=%d", count)


async def _async_stream_llm(prompt: str):
    """Async wrapper around _stream_llm that avoids StopIteration in executor."""
    loop = asyncio.get_running_loop()
    gen = _stream_llm(prompt)

    while True:
        try:
            chunk = await loop.run_in_executor(None, _next_chunk, gen)
            if chunk is None:
                break
            yield chunk
        except StopAsyncIteration:
            break


def _next_chunk(gen):
    """Thread-safe next() that returns None instead of raising StopIteration."""
    try:
        return next(gen)
    except StopIteration:
        return None


async def extract_resume_info(raw_text: str) -> CandidateInfo:
    prompt = RESUME_EXTRACTION_PROMPT.format(resume_text=raw_text)
    resp = Generation.call(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        result_format="message",
    )
    content = resp.output.choices[0].message.content
    data = _extract_json(content)
    return CandidateInfo(**data)


async def generate_interview_questions_stream(resume_context: str, risk_points: list[str]):
    prompt = INTERVIEW_QUESTIONS_PROMPT.format(
        resume_context=resume_context,
        risk_points="\n".join(f"- {r}" for r in risk_points) if risk_points else "暂无",
    )
    async for chunk in _async_stream_llm(prompt):
        yield chunk


async def incremental_analyze_stream(
    resume_context: str,
    current_sentence: str,
    accumulated_answer: str,
    current_question: str,
    conversation_history: list[dict] | None = None,
):
    history_text = _compress_history(conversation_history or [], keep_rounds=3)

    prompt = INCREMENTAL_ANALYSIS_PROMPT.format(
        resume_context=resume_context[:2000],
        conversation_history=history_text,
        current_question=current_question,
        accumulated_answer=accumulated_answer,
        current_sentence=current_sentence,
    )
    async for chunk in _async_stream_llm(prompt):
        yield chunk


async def analyze_answer_stream(
    resume_context: str,
    question: str,
    answer: str,
    conversation_history: list[dict] | None = None,
):
    """Per-answer STAR analysis (kept for backward compat, now uses qa_history format)."""
    # Build a qa_history-style list from the current round + history
    qa_list = list(conversation_history or [])
    qa_list.append({"question": question, "answer": answer})

    qa_text = ""
    for i, qa in enumerate(qa_list, 1):
        qa_text += f"第{i}轮 - 面试官: {qa.get('question', '')}\n"
        qa_text += f"第{i}轮 - 候选人: {qa.get('answer', '')}\n\n"

    prompt = STAR_ANALYSIS_PROMPT.format(
        resume_context=resume_context[:2000],
        qa_history=qa_text,
    )
    loop = asyncio.get_running_loop()
    gen = _stream_llm(prompt)
    while True:
        try:
            chunk = await loop.run_in_executor(None, next, gen)
            yield chunk
        except StopIteration:
            break


async def interview_evaluation_stream(
    resume_context: str,
    qa_history: list[dict],
):
    """Generate overall interview evaluation after the interview ends."""
    qa_text = ""
    for i, qa in enumerate(qa_history, 1):
        qa_text += f"第{i}轮 - 面试官: {qa.get('question', '')}\n"
        qa_text += f"第{i}轮 - 候选人: {qa.get('answer', '')}\n\n"

    prompt = STAR_ANALYSIS_PROMPT.format(
        resume_context=resume_context[:2000],
        qa_history=qa_text,
    )
    loop = asyncio.get_running_loop()
    gen = _stream_llm(prompt)
    while True:
        try:
            chunk = await loop.run_in_executor(None, next, gen)
            yield chunk
        except StopIteration:
            break
