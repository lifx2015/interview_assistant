import { useState, useCallback, useRef } from 'react';
import type {
  CandidateInfo,
  InterviewStatus,
  SpeakerRole,
  TranscriptEntry,
  QARecord,
  InterviewListItem,
  Question,
  BankQuestionGroup,
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
  const [qaHistory, setQaHistory] = useState<QARecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsRaw, setQuestionsRaw] = useState('');
  const [savedInterviews, setSavedInterviews] = useState<InterviewListItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const [followUpRaw, setFollowUpRaw] = useState('');
  const [evaluationRaw, setEvaluationRaw] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [psychologyRaw, setPsychologyRaw] = useState('');
  const [lastFollowUpRaw, setLastFollowUpRaw] = useState('');

  const [bankQuestionGroups, setBankQuestionGroups] = useState<BankQuestionGroup[]>([]);

  const sentenceIdRef = useRef(0);
  const wsSendRef = useRef<((data: any) => void) | null>(null);

  const setWsSend = useCallback((fn: (data: any) => void) => {
    wsSendRef.current = fn;
  }, []);

  const handleASRResult = useCallback((data: any) => {
    console.log('[useInterview] handleASRResult:', data);
    if (data.type === 'partial') {
      setCurrentPartial(data.text);
      return;
    }

    if (data.type === 'sentence') {
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
      return;
    }

    if (data.type === 'role_switched') {
      setCurrentRole(data.role);
      return;
    }

    if (data.type === 'follow_up_stream') {
      setIsAnalyzing(true);
      setFollowUpRaw((prev: string) => prev + data.data);
      return;
    }

    if (data.type === 'follow_up_complete') {
      setIsAnalyzing(false);
      return;
    }

    if (data.type === 'follow_up_clear') {
      setIsAnalyzing(false);
      setFollowUpRaw((prev) => {
        if (prev) setLastFollowUpRaw(prev);
        return '';
      });
      return;
    }

    if (data.type === 'answer_complete_ack') {
      if (data.question && data.answer) {
        setQaHistory((prev) => [...prev, { question: data.question, answer: data.answer }]);
      }
      setIsAnalyzing(false);
      setStatus('idle');
      return;
    }

    if (data.type === 'evaluation_start') {
      setIsEvaluating(true);
      setEvaluationRaw('');
      return;
    }

    if (data.type === 'evaluation_stream') {
      setEvaluationRaw((prev: string) => prev + data.data);
      return;
    }

    if (data.type === 'error') {
      setIsAnalyzing(false);
      setAppError(data.data || '未知错误');
      return;
    }

    if (data.type === 'evaluation_complete') {
      setIsEvaluating(false);
      setStatus('idle');
    }
  }, []);

  const switchRole = useCallback((role: SpeakerRole) => {
    setCurrentRole(role);
    if (role === 'candidate') {
      setFollowUpRaw((prev) => {
        if (prev) setLastFollowUpRaw(prev);
        return '';
      });
    }
  }, []);

  const startInterview = useCallback(() => {
    setStatus('recording');
    setTranscript([]);
    setCurrentPartial('');
    setInterviewerText('');
    setCandidateText('');
    setQaHistory([]);
    setFollowUpRaw('');
    setLastFollowUpRaw('');
    setEvaluationRaw('');
    setPsychologyRaw('');
    setIsAnalyzing(false);
    setIsEvaluating(false);
  }, []);

  const pauseInterview = useCallback(() => {
    setStatus('paused');
  }, []);

  const resumeInterview = useCallback(() => {
    setStatus('recording');
  }, []);

  const stopInterview = useCallback(() => {
    setStatus('evaluating');
    setIsAnalyzing(false);
    setFollowUpRaw((prev) => {
      if (prev) setLastFollowUpRaw(prev);
      return '';
    });
  }, []);

  const submitAnswer = useCallback(() => {
    setIsAnalyzing(false);
    setFollowUpRaw((prev) => {
      if (prev) setLastFollowUpRaw(prev);
      return '';
    });
  }, []);

  const generateQuestions = useCallback(async () => {
    if (!sessionId) return;
    setIsGeneratingQuestions(true);
    setQuestionsRaw('');
    console.log('[generateQuestions] start, sessionId:', sessionId);

    try {
      const url = `/api/interview/${sessionId}/generate-questions`;
      const res = await fetch(url);
      if (!res.ok || !res.body) {
        setAppError(`题目生成失败 (HTTP ${res.status})`);
        setIsGeneratingQuestions(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let pos;
        while ((pos = buffer.indexOf('\n\n')) !== -1) {
          const message = buffer.slice(0, pos);
          buffer = buffer.slice(pos + 2);

          if (message.startsWith('data: ')) {
            const data = message.slice(6);
            if (data === '[DONE]') continue;
            const content = data.split('\ndata: ').join('\n');
            setQuestionsRaw((prev) => prev + content);
          }
        }
      }
    } catch (e) {
      console.error('Failed to generate questions:', e);
      setAppError('题目生成请求失败，请检查网络连接');
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
          analysis_raw: '',
          evaluation_raw: evaluationRaw,
          questions_raw: questionsRaw,
          notes,
        }),
      });
    } catch (e) {
      console.error('Failed to save interview:', e);
      setAppError('面试保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, candidate, qaHistory, transcript, questionsRaw, evaluationRaw]);

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
      setQuestionsRaw(data.questions_raw || '');
      setStatus('idle');
      setCurrentRole('interviewer');
      setCurrentPartial('');
      setInterviewerText('');
      setCandidateText('');
      setFollowUpRaw('');
      setLastFollowUpRaw('');
      setEvaluationRaw(data.evaluation_raw || '');
      setIsEvaluating(false);
      setIsAnalyzing(false);

      return data.notes || '';
    } catch (e) {
      console.error('Failed to load interview:', e);
      return undefined;
    }
  }, []);

  const addBankGroup = useCallback((group: BankQuestionGroup) => {
    setBankQuestionGroups((prev) => {
      const existingIndex = prev.findIndex((g) => g.bankId === group.bankId);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const existingIds = new Set(existing.questions.map((q: Question) => q.id));
        const newQuestions = group.questions.filter((q: Question) => !existingIds.has(q.id));
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          questions: [...existing.questions, ...newQuestions],
        };
        return updated;
      }
      return [...prev, group];
    });
  }, []);

  const removeBankGroup = useCallback((bankId: string) => {
    setBankQuestionGroups((prev) => prev.filter((g) => g.bankId !== bankId));
  }, []);

  const clearBankGroups = useCallback(() => {
    setBankQuestionGroups([]);
  }, []);

  const clearAppError = useCallback(() => {
    setAppError(null);
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
    followUpRaw,
    lastFollowUpRaw,
    evaluationRaw,
    isEvaluating,
    psychologyRaw,
    bankQuestionGroups,
    addBankGroup,
    removeBankGroup,
    clearBankGroups,
    appError,
    clearAppError,
  };
}
