export interface CandidateInfo {
  name: string;
  phone: string;
  email: string;
  education: string[];
  work_experience: string[];
  skills: string[];
  projects: string[];
  summary: string;
}

export interface ResumeUploadResponse {
  session_id: string;
  candidate: CandidateInfo;
}

export interface ASRResult {
  type: 'partial' | 'sentence' | 'error';
  text: string;
  sentence_id: number;
}

export interface StarFollowUp {
  dimension: string;
  question: string;
  purpose: string;
}

export interface RiskAssessment {
  risk_level: 'low' | 'medium' | 'high';
  risk_type: string;
  description: string;
  suggestion: string;
}

export interface AnalysisResult {
  star_followups: StarFollowUp[];
  risk_assessments: RiskAssessment[];
  overall_comment: string;
}

export interface QARecord {
  question: string;
  answer: string;
  analysis: string;
}

export type InterviewStatus = 'idle' | 'recording' | 'paused' | 'analyzing';
