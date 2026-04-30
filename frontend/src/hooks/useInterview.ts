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
  const [pendingSentences, setPendingSentences] = useState<{text: string, sentence_id: number}[]>([]);
  const [currentPartial, setCurrentPartial] = useState('');
  const [partialByRole, setPartialByRole] = useState<Record<SpeakerRole, string>>({
    interviewer: '',
    candidate: '',
  });
  const [interviewerText, setInterviewerText] = useState('');
  const [candidateText, setCandidateText] = useState('');
  const [qaHistory, setQaHistory] = useState<QARecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsRaw, setQuestionsRaw] = useState('');
  const [savedInterviews, setSavedInterviews] = useState<InterviewListItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingPaths, setRecordingPaths] = useState<string[]>([]);
  const [appError, setAppError] = useState<string | null>(null);

  const [followUpRaw, setFollowUpRaw] = useState('');
  const followUpRawRef = useRef('');
  const _setFollowUpRaw = useCallback((value: string | ((prev: string) => string)) => {
    setFollowUpRaw((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      followUpRawRef.current = next;
      return next;
    });
  }, []);
  const [evaluationRaw, setEvaluationRaw] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [psychologyRaw, setPsychologyRaw] = useState('');
  const [isPsychologyAnalyzing, setIsPsychologyAnalyzing] = useState(false);
  const [lastFollowUpRaw, setLastFollowUpRaw] = useState('');

  const [bankQuestionGroups, setBankQuestionGroups] = useState<BankQuestionGroup[]>([]);

  const sentenceIdRef = useRef(0);
  const wsSendRef = useRef<((data: any) => void) | null>(null);

  const setWsSend = useCallback((fn: (data: any) => void) => {
    wsSendRef.current = fn;
  }, []);

  const addTranscriptEntry = (role: SpeakerRole, text: string) => {
    sentenceIdRef.current += 1;
    const entry: TranscriptEntry = {
      id: sentenceIdRef.current,
      role,
      text,
      isFinal: true,
      timestamp: Date.now(),
    };
    setTranscript(prev => [...prev, entry]);
    if (role === 'interviewer') {
      setInterviewerText(prev => prev + text);
    } else {
      setCandidateText(prev => prev + text);
    }
  };

  const messageHandlers: Record<string, (data: any) => void> = {
    partial: (data) => {
      if (data.role === 'interviewer' || data.role === 'candidate') {
        setPartialByRole(prev => ({ ...prev, [data.role]: data.text }));
      } else {
        setCurrentPartial(data.text);
      }
    },
    sentence_pending: (data) => {
      setPendingSentences(prev => [...prev, { text: data.text, sentence_id: data.sentence_id }]);
      setCurrentPartial('');
    },
    sentence_confirmed: (data) => {
      addTranscriptEntry(data.role || 'interviewer', data.text);
      setPendingSentences(prev => prev.filter(s => s.sentence_id !== data.sentence_id));
    },
    sentence: (data) => {
      addTranscriptEntry(data.role || 'interviewer', data.text);
      setCurrentPartial('');
      if (data.role === 'interviewer' || data.role === 'candidate') {
        setPartialByRole(prev => ({ ...prev, [data.role]: '' }));
      } else {
        setPartialByRole({ interviewer: '', candidate: '' });
      }
    },
    role_switched: (data) => {
      setCurrentRole(data.role);
    },
    follow_up_stream: (data) => {
      setIsAnalyzing(true);
      _setFollowUpRaw((prev: string) => prev + data.data);
    },
    follow_up_complete: () => {
      setIsAnalyzing(false);
    },
    follow_up_clear: () => {
      setIsAnalyzing(false);
      if (followUpRawRef.current) setLastFollowUpRaw(followUpRawRef.current);
      _setFollowUpRaw('');
    },
    answer_complete_ack: (data) => {
      if (data.question && data.answer) {
        setQaHistory((prev) => [...prev, { question: data.question, answer: data.answer }]);
      }
      setIsAnalyzing(false);
      setStatus('idle');
    },
    psychology_start: () => {
      setPsychologyRaw('');
      setIsPsychologyAnalyzing(true);
    },
    psychology_stream: (data) => {
      setPsychologyRaw((prev: string) => prev + data.data);
    },
    psychology_complete: () => {
      setIsPsychologyAnalyzing(false);
    },
    evaluation_start: () => {
      setIsEvaluating(true);
      setEvaluationRaw('');
    },
    evaluation_stream: (data) => {
      setEvaluationRaw((prev: string) => prev + data.data);
    },
    evaluation_complete: () => {
      setIsEvaluating(false);
      setStatus('idle');
    },
    error: (data) => {
      setIsAnalyzing(false);
      setAppError(typeof data.data === 'string' ? data.data : JSON.stringify(data.data) || '未知错误');
    },
  };

  const handleASRResult = useCallback((data: any) => {
    const handler = messageHandlers[data.type];
    if (handler) handler(data);
  }, []);

  const switchRole = useCallback((role: SpeakerRole) => {
    setCurrentRole(role);
    if (role === 'candidate') {
      if (followUpRawRef.current) setLastFollowUpRaw(followUpRawRef.current);
      _setFollowUpRaw('');
    }
  }, [_setFollowUpRaw]);

  const startInterview = useCallback(() => {
    setStatus('recording');
    setTranscript([]);
    setCurrentPartial('');
    setPartialByRole({ interviewer: '', candidate: '' });
    setInterviewerText('');
    setCandidateText('');
    setQaHistory([]);
    _setFollowUpRaw('');
    setLastFollowUpRaw('');
    setEvaluationRaw('');
    setPsychologyRaw('');
    setIsPsychologyAnalyzing(false);
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
    if (followUpRawRef.current) setLastFollowUpRaw(followUpRawRef.current);
    _setFollowUpRaw('');
  }, [_setFollowUpRaw]);

  const submitAnswer = useCallback(() => {
    setIsAnalyzing(false);
    if (followUpRawRef.current) setLastFollowUpRaw(followUpRawRef.current);
    _setFollowUpRaw('');
  }, [_setFollowUpRaw]);

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
      const res = await fetch('/api/interview/save', {
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
      if (res.ok) {
        const data = await res.json();
        if (data.recording_paths) {
          setRecordingPaths(data.recording_paths);
        }
      }
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
      _setFollowUpRaw('');
      setLastFollowUpRaw('');
      setEvaluationRaw(data.evaluation_raw || '');
      setIsEvaluating(false);
      setIsAnalyzing(false);
      setRecordingPaths(data.recording_paths || []);

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

  const triggerFollowUp = useCallback(() => {
    wsSendRef.current?.({ type: 'control', action: 'trigger_follow_up' });
  }, []);

  const triggerPsychology = useCallback(() => {
    wsSendRef.current?.({ type: 'control', action: 'trigger_psychology' });
  }, []);

  return {
    status,
    sessionId,
    candidate,
    currentRole,
    transcript,
    pendingSentences,
    currentPartial,
    partialByRole,
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
    recordingPaths,
    saveInterview,
    fetchInterviewList,
    loadInterview,
    setWsSend,
    followUpRaw,
    lastFollowUpRaw,
    evaluationRaw,
    isEvaluating,
    psychologyRaw,
    isPsychologyAnalyzing,
    bankQuestionGroups,
    addBankGroup,
    removeBankGroup,
    clearBankGroups,
    appError,
    clearAppError,
    triggerFollowUp,
    triggerPsychology,
  };
}
