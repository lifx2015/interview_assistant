export type InterviewMode = 'dual-track' | 'single-track';

export type SpeakerRole = 'interviewer' | 'candidate';

export interface Education {
  school: string;
  degree: string;
  major: string;
  period: string;
}

export interface JobMatchResult {
  job_name: string;
  match_level: string;
  summary: string;
  points: string[];
}

export interface CandidateInfo {
  name: string;
  phone: string;
  email: string;
  education: Education[];
  skills: string[];
  summary: string;
  risk_points: string[];
  job_match: JobMatchResult | null;
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
  recording_paths?: string[];
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

export interface JobRequirement {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface EvaluationScoreItem {
  score: number;
  label: string;
  desc: string;
}

export interface EvaluationJobMatchItem {
  level: string;
  desc: string;
}

export interface EvaluationResult {
  summary: string;
  scores: {
    professional: EvaluationScoreItem;
    clarity: EvaluationScoreItem;
    logic: EvaluationScoreItem;
    authenticity: EvaluationScoreItem;
    jobFit: EvaluationScoreItem;
  };
  jobMatch: {
    coreSkill: EvaluationJobMatchItem;
    experience: EvaluationJobMatchItem;
    softSkill: EvaluationJobMatchItem;
    overall: string;
    summary: string;
  };
  highlights: string[];
  risks: string[];
  recommendation: {
    hire: boolean;
    reason: string;
    nextFocus: string;
  };
}

export interface AudioUploadProgressEvent {
  stage: 'converting' | 'transcribing' | 'parsing' | 'evaluating' | 'psychology' | 'complete' | 'error';
  message: string;
  session_id?: string;
  candidate?: CandidateInfo;
  transcript?: { role: SpeakerRole; text: string }[];
  qa_history?: QARecord[];
  evaluation_result?: EvaluationResult;
  evaluation_error?: string;
  psychology_raw?: string;
}
