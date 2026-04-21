from pydantic import BaseModel


class CandidateInfo(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""
    education: list[str] = []
    work_experience: list[str] = []
    skills: list[str] = []
    projects: list[str] = []
    summary: str = ""


class ResumeUploadResponse(BaseModel):
    session_id: str
    candidate: CandidateInfo


class ASRResult(BaseModel):
    type: str  # "partial" | "sentence" | "analysis"
    text: str = ""
    sentence_id: int = 0


class AnalysisRequest(BaseModel):
    session_id: str
    question: str
    answer: str
    resume_context: str = ""


class StarFollowUp(BaseModel):
    dimension: str  # Situation | Task | Action | Result
    question: str
    purpose: str


class RiskAssessment(BaseModel):
    risk_level: str  # low | medium | high
    risk_type: str
    description: str
    suggestion: str


class AnalysisResult(BaseModel):
    star_followups: list[StarFollowUp]
    risk_assessments: list[RiskAssessment]
    overall_comment: str = ""


class WSMessage(BaseModel):
    type: str  # "audio" | "control" | "asr_result" | "analysis_result" | "error"
    data: str = ""  # base64 audio or JSON string
