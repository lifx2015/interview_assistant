import json

import dashscope
from dashscope import Generation

from backend.config import settings
from backend.models.schemas import CandidateInfo
from backend.prompts.star_analysis import (
    RESUME_EXTRACTION_PROMPT,
    STAR_ANALYSIS_PROMPT,
    INTERVIEW_QUESTIONS_PROMPT,
)


dashscope.api_key = settings.dashscope_api_key


def _extract_json(content: str) -> dict:
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    return json.loads(content.strip())


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


async def generate_interview_questions(resume_context: str, risk_points: list[str]) -> dict:
    prompt = INTERVIEW_QUESTIONS_PROMPT.format(
        resume_context=resume_context,
        risk_points="\n".join(f"- {r}" for r in risk_points) if risk_points else "暂无",
    )
    resp = Generation.call(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        result_format="message",
    )
    content = resp.output.choices[0].message.content
    return _extract_json(content)


async def generate_interview_questions_stream(resume_context: str, risk_points: list[str]):
    prompt = INTERVIEW_QUESTIONS_PROMPT.format(
        resume_context=resume_context,
        risk_points="\n".join(f"- {r}" for r in risk_points) if risk_points else "暂无",
    )

    responses = Generation.call(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        result_format="message",
        stream=True,
        incremental_output=True,
    )

    for resp in responses:
        if resp.output and resp.output.choices:
            delta = resp.output.choices[0].message.content
            if delta:
                yield delta


async def analyze_answer_stream(
    resume_context: str,
    question: str,
    answer: str,
    conversation_history: list[dict] | None = None,
):
    # Build conversation context from history
    history_text = ""
    if conversation_history and len(conversation_history) > 1:
        history_lines = []
        for i, qa in enumerate(conversation_history[:-1], 1):
            history_lines.append(f"第{i}轮 - 面试官: {qa.get('question', '')}")
            history_lines.append(f"第{i}轮 - 候选人: {qa.get('answer', '')}")
        history_text = "\n## 之前的面试对话\n" + "\n".join(history_lines)

    prompt = STAR_ANALYSIS_PROMPT.format(
        resume_context=resume_context,
        question=question,
        answer=answer,
        conversation_history=history_text,
    )

    responses = Generation.call(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        result_format="message",
        stream=True,
        incremental_output=True,
    )

    for resp in responses:
        if resp.output and resp.output.choices:
            delta = resp.output.choices[0].message.content
            if delta:
                yield delta
