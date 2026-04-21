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
    risk_points: list[str] = []


class ResumeUploadResponse(BaseModel):
    session_id: str
    candidate: CandidateInfo


class InterviewQuestion(BaseModel):
    question: str
    dimension: str  # STAR dimension or category
    focus: str  # what to focus on


class GenerateQuestionsResponse(BaseModel):
    questions: list[InterviewQuestion]


class TranscriptEntry(BaseModel):
    role: str  # "interviewer" | "candidate"
    text: str
    sentence_id: int = 0


class QARecord(BaseModel):
    question: str
    answer: str
    analysis: str = ""


class StarFollowUp(BaseModel):
    dimension: str
    question: str
    purpose: str


class RiskAssessment(BaseModel):
    risk_level: str
    risk_type: str
    description: str
    suggestion: str


class AnalysisResult(BaseModel):
    star_followups: list[StarFollowUp]
    risk_assessments: list[RiskAssessment]
    overall_comment: str = ""
