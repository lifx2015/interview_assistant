import { useState, useCallback, useRef } from 'react';
import type {
  CandidateInfo,
  InterviewStatus,
  AnalysisResult,
  SpeakerRole,
  TranscriptEntry,
  InterviewQuestion,
  QARecord,
} from '../types';

export function useInterview() {
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [currentRole, setCurrentRole] = useState<SpeakerRole>('interviewer');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentPartial, setCurrentPartial] = useState('');
  const [interviewerText, setInterviewerText] = useState('');
  const [candidateText, setCandidateText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisRaw, setAnalysisRaw] = useState('');
  const [qaHistory, setQaHistory] = useState<QARecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(-1);

  const sentenceIdRef = useRef(0);

  const handleASRResult = useCallback((data: any) => {
    if (data.type === 'partial') {
      setCurrentPartial(data.text);
    } else if (data.type === 'sentence') {
      sentenceIdRef.current += 1;
      const entry: TranscriptEntry = {
        id: sentenceIdRef.current,
        role: data.role || 'interviewer',
        text: data.text,
        isFinal: true,
        timestamp: Date.now(),
      };
      setTranscript((prev) => [...prev, entry]);
      if (entry.role === 'interviewer') {
        setInterviewerText((prev) => prev + data.text);
      } else {
        setCandidateText((prev) => prev + data.text);
      }
      setCurrentPartial('');
    } else if (data.type === 'role_switched') {
      setCurrentRole(data.role);
    }
  }, []);

  const handleAnalysisStream = useCallback((data: any) => {
    if (data.type === 'analysis_stream') {
      setAnalysisRaw((prev) => prev + data.data);
    } else if (data.type === 'analysis_complete') {
      try {
        let content = data.data;
        if (content.includes('```json')) {
          content = content.split('```json')[1].split('```')[0];
        } else if (content.includes('```')) {
          content = content.split('```')[1].split('```')[0];
        }
        const parsed = JSON.parse(content.trim());
        setAnalysis(parsed);
      } catch {
        setAnalysisRaw(data.data);
      }
      setIsAnalyzing(false);
      setStatus('idle');
    }
  }, []);

  const switchRole = useCallback((role: SpeakerRole) => {
    setCurrentRole(role);
  }, []);

  const startInterview = useCallback(() => {
    setStatus('recording');
    setTranscript([]);
    setCurrentPartial('');
    setInterviewerText('');
    setCandidateText('');
    setAnalysis(null);
    setAnalysisRaw('');
  }, []);

  const pauseInterview = useCallback(() => {
    setStatus('paused');
  }, []);

  const resumeInterview = useCallback(() => {
    setStatus('recording');
  }, []);

  const stopInterview = useCallback(() => {
    setStatus('idle');
  }, []);

  const submitAnswer = useCallback(() => {
    setIsAnalyzing(true);
    setStatus('analyzing');
  }, []);

  const generateQuestions = useCallback(async () => {
    if (!sessionId) return;
    setIsGeneratingQuestions(true);
    try {
      const res = await fetch(`/api/interview/${sessionId}/generate-questions`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setInterviewQuestions(data.questions || []);
      }
    } catch (e) {
      console.error('Failed to generate questions:', e);
    } finally {
      setIsGeneratingQuestions(false);
    }
  }, [sessionId]);

  const onUploadSuccess = useCallback((sid: string, info: CandidateInfo) => {
    setSessionId(sid);
    setCandidate(info);
  }, []);

  return {
    status,
    sessionId,
    candidate,
    currentRole,
    transcript,
    currentPartial,
    interviewerText,
    candidateText,
    analysis,
    analysisRaw,
    qaHistory,
    isAnalyzing,
    interviewQuestions,
    isGeneratingQuestions,
    activeQuestionIndex,
    setActiveQuestionIndex,
    switchRole,
    handleASRResult,
    handleAnalysisStream,
    startInterview,
    pauseInterview,
    resumeInterview,
    stopInterview,
    submitAnswer,
    generateQuestions,
    onUploadSuccess,
  };
}
