from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _none_to_empty(v: Optional[str]) -> str:
    return v if v is not None else ""


class Education(BaseModel):
    model_config = ConfigDict(extra="ignore")

    school: str = ""
    degree: str = ""
    major: str = ""
    period: str = ""

    _normalize_school = field_validator("school", mode="before")(_none_to_empty)
    _normalize_degree = field_validator("degree", mode="before")(_none_to_empty)
    _normalize_major = field_validator("major", mode="before")(_none_to_empty)
    _normalize_period = field_validator("period", mode="before")(_none_to_empty)


class CandidateInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    phone: str = ""
    email: str = ""
    education: list[Education] = []
    skills: list[str] = []
    summary: str = ""
    risk_points: list[str] = []

    _normalize_name = field_validator("name", mode="before")(_none_to_empty)
    _normalize_phone = field_validator("phone", mode="before")(_none_to_empty)
    _normalize_email = field_validator("email", mode="before")(_none_to_empty)
    _normalize_summary = field_validator("summary", mode="before")(_none_to_empty)

    @field_validator("skills", "risk_points", "education", mode="before")
    @classmethod
    def _none_to_empty_list(cls, v):
        return v if v is not None else []


class ResumeUploadResponse(BaseModel):
    session_id: str
    candidate: CandidateInfo


class TranscriptEntry(BaseModel):
    role: str
    text: str
    sentence_id: int = 0


class QARecord(BaseModel):
    question: str
    answer: str


class SaveInterviewRequest(BaseModel):
    session_id: str
    candidate: dict
    resume_text: str = ""
    qa_history: list[dict] = []
    transcript: list[dict] = []
    analysis_raw: str = ""
    evaluation_raw: str = ""
    questions_raw: str = ""
    notes: str = ""


class InterviewListItem(BaseModel):
    session_id: str
    candidate_name: str
    created_at: str
