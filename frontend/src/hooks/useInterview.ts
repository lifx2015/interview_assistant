import { useState, useCallback, useRef } from 'react';
import type {
  CandidateInfo,
  InterviewStatus,
  SpeakerRole,
  TranscriptEntry,
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
  const [analysisRaw, setAnalysisRaw] = useState('');
  const [qaHistory, setQaHistory] = useState<QARecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsRaw, setQuestionsRaw] = useState('');
  const [savedInterviews, setSavedInterviews] = useState<InterviewListItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [incrementalRaw, setIncrementalRaw] = useState('');
  const [followUpRaw, setFollowUpRaw] = useState('');

  const sentenceIdRef = useRef(0);
  const wsSendRef = useRef<((data: any) => void) | null>(null);

  const setWsSend = useCallback((fn: (data: any) => void) => {
    wsSendRef.current = fn;
  }, []);

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
    } else if (data.type === 'incremental_analysis_stream') {
      setIncrementalRaw((prev) => prev + data.data);
    } else if (data.type === 'incremental_analysis_complete') {
      // Keep incrementalRaw as-is
    } else if (data.type === 'incremental_analysis_clear') {
      setIncrementalRaw('');
      setFollowUpRaw('');
    } else if (data.type === 'follow_up_stream') {
      setFollowUpRaw((prev) => prev + data.data);
    } else if (data.type === 'follow_up_complete') {
      // Keep followUpRaw as-is
    } else if (data.type === 'analysis_stream') {
      setAnalysisRaw((prev) => prev + data.data);
    } else if (data.type === 'analysis_complete') {
      setIncrementalRaw('');
      setIsAnalyzing(false);
      setStatus('idle');
    }
  }, []);

  const switchRole = useCallback((role: SpeakerRole) => {
    setCurrentRole(role);
    // Clear follow-up when switching to candidate (new answer starts)
    if (role === 'candidate') {
      setFollowUpRaw('');
    }
  }, []);

  const startInterview = useCallback(() => {
    setStatus('recording');
    setTranscript([]);
    setCurrentPartial('');
    setInterviewerText('');
    setCandidateText('');
    setAnalysisRaw('');
    setIncrementalRaw('');
    setIsAnalyzing(false);
  }, []);

  const pauseInterview = useCallback(() => {
    setStatus('paused');
  }, []);

  const resumeInterview = useCallback(() => {
    setStatus('recording');
  }, []);

  const stopInterview = useCallback(() => {
    setStatus('idle');
    setIsAnalyzing(false);
    setIncrementalRaw('');
  }, []);

  const submitAnswer = useCallback(() => {
    setIsAnalyzing(true);
    setStatus('analyzing');
    setFollowUpRaw(''); // Clear follow-up suggestions when answer is submitted
  }, []);

  // Independent of WebSocket — uses HTTP SSE
  const generateQuestions = useCallback(async () => {
    if (!sessionId) return;
    setIsGeneratingQuestions(true);
    setQuestionsRaw('');
    console.log('[generateQuestions] start, sessionId:', sessionId);

    try {
      const url = `/api/interview/${sessionId}/generate-questions`;
      console.log('[generateQuestions] fetching:', url);
      const res = await fetch(url);
      console.log('[generateQuestions] response status:', res.status, 'ok:', res.ok, 'has body:', !!res.body);
      if (!res.ok || !res.body) {
        console.error('[generateQuestions] fetch failed, status:', res.status);
        setIsGeneratingQuestions(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[generateQuestions] stream done, total chunks:', chunkCount);
          break;
        }

        chunkCount++;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            setQuestionsRaw((prev) => {
              const next = prev + data;
              if (chunkCount <= 3) console.log('[generateQuestions] chunk', chunkCount, 'data:', data.substring(0, 80));
              return next;
            });
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        if (data !== '[DONE]') {
          setQuestionsRaw((prev) => prev + data);
        }
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
          analysis_raw: analysisRaw,
          questions_raw: questionsRaw,
          notes,
        }),
      });
    } catch (e) {
      console.error('Failed to save interview:', e);
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, candidate, qaHistory, transcript, analysisRaw, questionsRaw]);

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
      setAnalysisRaw(data.analysis_raw || '');
      setQuestionsRaw(data.questions_raw || '');
      setStatus('idle');
      setCurrentRole('interviewer');
      setCurrentPartial('');
      setInterviewerText('');
      setCandidateText('');
      setIncrementalRaw('');
      setFollowUpRaw('');

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
    analysisRaw,
    qaHistory,
    isAnalyzing,
    isGeneratingQuestions,
    questionsRaw,
    switchRole,
    handleASRResult,
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
    setWsSend,
    incrementalRaw,
    followUpRaw,
    setFollowUpRaw,
  };
}
