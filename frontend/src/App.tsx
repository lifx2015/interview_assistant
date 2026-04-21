import { useCallback, useRef, useState } from 'react';
import { MainLayout } from './components/MainLayout';
import { useInterview } from './hooks/useInterview';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioCapture } from './hooks/useAudioCapture';
import type { SpeakerRole } from './types';
import './styles/global.css';
import './styles/animations.css';

function App() {
  const interview = useInterview();
  const audioStartedRef = useRef(false);
  const [noteContent, setNoteContent] = useState('');

  const handleWSMessage = useCallback((data: any) => {
    if (data.type === 'partial' || data.type === 'sentence' || data.type === 'role_switched') {
      interview.handleASRResult(data);
    } else if (data.type === 'analysis_stream' || data.type === 'analysis_complete') {
      interview.handleAnalysisStream(data);
    } else if (data.type === 'error') {
      console.error('WS error:', data.data);
    }
  }, [interview.handleASRResult, interview.handleAnalysisStream]);

  const ws = useWebSocket({
    url: `ws://${window.location.hostname}:8000/ws/asr/${interview.sessionId || 'pending'}`,
    onMessage: handleWSMessage,
  });

  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    ws.sendBinary(pcmBuffer);
  }, [ws.sendBinary]);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  const handleStart = useCallback(async () => {
    if (!interview.sessionId) return;
    ws.connect();
    await new Promise((r) => setTimeout(r, 300));
    await audio.start();
    audioStartedRef.current = true;
    interview.startInterview();
  }, [interview.sessionId, ws.connect, audio.start, interview.startInterview]);

  const handlePause = useCallback(() => {
    audio.pause();
    ws.send({ type: 'control', action: 'pause' });
    interview.pauseInterview();
  }, [audio.pause, ws.send, interview.pauseInterview]);

  const handleResume = useCallback(() => {
    audio.resume();
    ws.send({ type: 'control', action: 'resume' });
    interview.resumeInterview();
  }, [audio.resume, ws.send, interview.resumeInterview]);

  const handleStop = useCallback(() => {
    audio.stop();
    ws.send({ type: 'control', action: 'stop' });
    ws.disconnect();
    audioStartedRef.current = false;
    interview.stopInterview();
  }, [audio.stop, ws.send, ws.disconnect, interview.stopInterview]);

  const handleSubmitAnswer = useCallback(() => {
    ws.send({ type: 'control', action: 'answer_complete' });
    interview.submitAnswer();
  }, [ws.send, interview.submitAnswer]);

  const handleSwitchRole = useCallback((role: SpeakerRole) => {
    interview.switchRole(role);
    ws.send({ type: 'control', action: 'switch_role', role });
  }, [interview.switchRole, ws.send]);

  return (
    <MainLayout
      candidate={interview.candidate}
      sessionId={interview.sessionId}
      status={interview.status}
      currentRole={interview.currentRole}
      transcript={interview.transcript}
      currentPartial={interview.currentPartial}
      analysis={interview.analysis}
      analysisRaw={interview.analysisRaw}
      isAnalyzing={interview.isAnalyzing}
      interviewQuestions={interview.interviewQuestions}
      isGeneratingQuestions={interview.isGeneratingQuestions}
      activeQuestionIndex={interview.activeQuestionIndex}
      noteContent={noteContent}
      onNoteChange={setNoteContent}
      onUploadSuccess={interview.onUploadSuccess}
      onSwitchRole={handleSwitchRole}
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onSubmitAnswer={handleSubmitAnswer}
      onGenerateQuestions={interview.generateQuestions}
      onSelectQuestion={interview.setActiveQuestionIndex}
    />
  );
}

export default App;
