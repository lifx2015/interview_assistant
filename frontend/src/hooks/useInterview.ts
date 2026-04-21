import { useState, useCallback, useRef } from 'react';
import type {
  CandidateInfo,
  InterviewStatus,
  AnalysisResult,
  QARecord,
} from '../types';

interface TranscriptEntry {
  id: number;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export function useInterview() {
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [currentPartial, setCurrentPartial] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisRaw, setAnalysisRaw] = useState('');
  const [qaHistory, setQaHistory] = useState<QARecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const sentenceIdRef = useRef(0);

  const handleASRResult = useCallback((data: any) => {
    if (data.type === 'partial') {
      setCurrentPartial(data.text);
    } else if (data.type === 'sentence') {
      sentenceIdRef.current += 1;
      const entry: TranscriptEntry = {
        id: sentenceIdRef.current,
        text: data.text,
        isFinal: true,
        timestamp: Date.now(),
      };
      setTranscript((prev) => [...prev, entry]);
      setCurrentAnswer((prev) => prev + data.text);
      setCurrentPartial('');
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

  const startInterview = useCallback(() => {
    setStatus('recording');
    setTranscript([]);
    setCurrentPartial('');
    setCurrentAnswer('');
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
    if (currentAnswer.trim()) {
      setQaHistory((prev) => [
        ...prev,
        { question: currentQuestion, answer: currentAnswer, analysis: analysisRaw },
      ]);
    }
    setIsAnalyzing(true);
    setStatus('analyzing');
    setCurrentAnswer('');
    setTranscript([]);
  }, [currentAnswer, currentQuestion, analysisRaw]);

  const onUploadSuccess = useCallback((sid: string, info: CandidateInfo) => {
    setSessionId(sid);
    setCandidate(info);
  }, []);

  return {
    status,
    sessionId,
    candidate,
    transcript,
    currentPartial,
    currentQuestion,
    currentAnswer,
    analysis,
    analysisRaw,
    qaHistory,
    isAnalyzing,
    setCurrentQuestion,
    handleASRResult,
    handleAnalysisStream,
    startInterview,
    pauseInterview,
    resumeInterview,
    stopInterview,
    submitAnswer,
    onUploadSuccess,
  };
}
