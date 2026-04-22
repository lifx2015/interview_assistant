export type SpeakerRole = 'interviewer' | 'candidate';

export interface Education {
  school: string;
  degree: string;
  major: string;
  period: string;
}

export interface CandidateInfo {
  name: string;
  phone: string;
  email: string;
  education: Education[];
  skills: string[];
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

export interface QARecord {
  question: string;
  answer: string;
}

export type InterviewStatus = 'idle' | 'recording' | 'paused' | 'analyzing';

export interface InterviewListItem {
  session_id: string;
  candidate_name: string;
  created_at: string;
}
