export type SpeakerRole = 'interviewer' | 'candidate';

export interface CandidateInfo {
  name: string;
  phone: string;
  email: string;
  education: string[];
  work_experience: string[];
  skills: string[];
  projects: string[];
  summary: string;
  risk_points: string[];
}

export interface ResumeUploadResponse {
  session_id: string;
  candidate: CandidateInfo;
}

export interface TranscriptEntry {
  id: number;
  role: SpeakerRole;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface InterviewQuestion {
  question: string;
  dimension: string;
  focus: string;
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

export interface InterviewListItem {
  session_id: string;
  candidate_name: string;
  created_at: string;
}
