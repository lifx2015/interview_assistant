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

export type InterviewStatus = 'idle' | 'recording' | 'paused' | 'analyzing' | 'evaluating';

export interface InterviewListItem {
  session_id: string;
  candidate_name: string;
  created_at: string;
}

export interface Question {
  id: string;
  content: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// 按题库分组的题目（用于面试页面）
export interface BankQuestionGroup {
  bankId: string;
  bankName: string;
  questions: Question[];
}
