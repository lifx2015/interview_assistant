import { useState, useCallback, useRef } from 'react';
import type {
  CandidateInfo,
  InterviewStatus,
  AnalysisResult,
  SpeakerRole,
  TranscriptEntry,
  InterviewQuestion,
  QARecord,
  InterviewListItem,
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
  const [savedInterviews, setSavedInterviews] = useState<InterviewListItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

  const saveInterview = useCallback(async (notes: string) => {
    if (!sessionId || !candidate) return;
    setIsSaving(true);
    try {
      await fetch('/api/interview/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          candidate,
          qa_history: qaHistory,
          transcript,
          analysis,
          analysis_raw: analysisRaw,
          questions: interviewQuestions,
          notes,
        }),
      });
    } catch (e) {
      console.error('Failed to save interview:', e);
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, candidate, qaHistory, transcript, analysis, analysisRaw, interviewQuestions]);

  const fetchInterviewList = useCallback(async () => {
    try {
      const res = await fetch('/api/interview/list');
      if (res.ok) {
        const data = await res.json();
        setSavedInterviews(data);
      }
    } catch (e) {
      console.error('Failed to fetch interview list:', e);
    }
  }, []);

  const loadInterview = useCallback(async (targetSessionId: string) => {
    try {
      const res = await fetch(`/api/interview/${targetSessionId}/load`);
      if (!res.ok) return;
      const data = await res.json();

      setSessionId(data.session_id);
      setCandidate(data.candidate);
      setQaHistory(data.qa_history || []);
      setTranscript(data.transcript || []);
      setAnalysis(data.analysis || null);
      setAnalysisRaw(data.analysis_raw || '');
      setInterviewQuestions(data.questions || []);
      setStatus('idle');
      setCurrentRole('interviewer');
      setCurrentPartial('');
      setInterviewerText('');
      setCandidateText('');
      setActiveQuestionIndex(-1);

      return data.notes || '';
    } catch (e) {
      console.error('Failed to load interview:', e);
      return undefined;
    }
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
    savedInterviews,
    isSaving,
    saveInterview,
    fetchInterviewList,
    loadInterview,
  };
}
