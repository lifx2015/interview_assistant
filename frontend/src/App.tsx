import React, { useCallback, useRef, useState, useEffect } from 'react';
import { MainLayout } from './components/MainLayout';
import { useInterview } from './hooks/useInterview';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioCapture } from './hooks/useAudioCapture';
import type { InterviewStatus } from './types';
import './styles/global.css';
import './styles/animations.css';
import './styles/markdown.css';

function App() {
  const interview = useInterview();
  const audioStartedRef = useRef(false);
  const [noteContent, setNoteContent] = useState('');
  const prevStatusRef = useRef<InterviewStatus>('idle');
  const [voiceprintEnabled, setVoiceprintEnabled] = useState(false);

  const handleWSMessage = useCallback((data: any) => {
    if (data.type === 'error') {
      interview.handleASRResult(data);
    } else if (data.type === 'role_switched') {
      if (data.detected_by === 'voiceprint') {
        console.log('[Voiceprint] Auto-switched role to:', data.role, 'confidence:', data.confidence);
      }
      interview.switchRole(data.role);
    } else if (data.type === 'voiceprint_status') {
      setVoiceprintEnabled(data.enabled);
    } else {
      interview.handleASRResult(data);
    }
  }, [interview.handleASRResult, interview.switchRole]);

  const ws = useWebSocket({
    url: `ws://${window.location.hostname}:8000/ws/asr/${interview.sessionId || 'pending'}`,
    onMessage: handleWSMessage,
    onOpen: () => {
      // Reset voiceprint state on new connection — backend defaults to disabled
      setVoiceprintEnabled(false);
    },
  });

  useEffect(() => {
    interview.setWsSend(ws.send);
  }, [ws.send, interview.setWsSend]);

  // 监听面试评估完成，断开 WebSocket
  useEffect(() => {
    if (prevStatusRef.current === 'evaluating' && interview.status === 'idle') {
      ws.disconnect();
      audioStartedRef.current = false;
    }
    prevStatusRef.current = interview.status;
  }, [interview.status, ws]);

  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    ws.sendBinary(pcmBuffer);
  }, [ws.sendBinary]);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  // P0-3: 等待 WebSocket 真正连接后再开始录音
  const [waitingForWs, setWaitingForWs] = useState(false);

  useEffect(() => {
    if (waitingForWs && ws.status === 'connected') {
      setWaitingForWs(false);
      audio.start().then(() => {
        audioStartedRef.current = true;
        interview.startInterview();
      });
    }
  }, [waitingForWs, ws.status, audio, interview.startInterview]);

  const handleStart = useCallback(async () => {
    if (!interview.sessionId) return;
    ws.connect();
    setWaitingForWs(true);
  }, [interview.sessionId, ws.connect]);

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
    interview.stopInterview();
  }, [audio, ws, interview]);

  const handleSubmitAnswer = useCallback(() => {
    ws.send({ type: 'control', action: 'answer_complete' });
    interview.submitAnswer();
  }, [ws.send, interview.submitAnswer]);

  const handleSave = useCallback(() => {
    interview.saveInterview(noteContent);
  }, [interview.saveInterview, noteContent]);

  const handleLoadInterview = useCallback(async (sessionId: string) => {
    const notes = await interview.loadInterview(sessionId);
    if (notes !== undefined) {
      setNoteContent(notes);
    }
  }, [interview.loadInterview]);

  const handleReconnect = useCallback(() => {
    ws.clearError();
    if (interview.sessionId) {
      ws.connect();
    }
  }, [ws.clearError, ws.connect, interview.sessionId]);

  // P0-2: 声纹识别启用/禁用
  const handleToggleVoiceprint = useCallback(() => {
    if (ws.status !== 'connected') return;
    const action = voiceprintEnabled ? 'disable_voiceprint' : 'enable_voiceprint';
    ws.send({ type: 'control', action });
  }, [ws.status, ws.send, voiceprintEnabled]);

  const handleManualRoleSwitch = useCallback((role: 'interviewer' | 'candidate') => {
    if (ws.status !== 'connected') return;
    ws.send({ type: 'control', action: 'switch_role', role });
  }, [ws.status, ws.send]);

  return (
    <MainLayout
      candidate={interview.candidate}
      sessionId={interview.sessionId}
      status={interview.status}
      currentRole={interview.currentRole}
      transcript={interview.transcript}
      currentPartial={interview.currentPartial}
      isAnalyzing={interview.isAnalyzing}
      isGeneratingQuestions={interview.isGeneratingQuestions}
      questionsRaw={interview.questionsRaw}
      followUpRaw={interview.followUpRaw}
      lastFollowUpRaw={interview.lastFollowUpRaw}
      evaluationRaw={interview.evaluationRaw}
      isEvaluating={interview.isEvaluating}
      noteContent={noteContent}
      onNoteChange={setNoteContent}
      onUploadSuccess={interview.onUploadSuccess}
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onSubmitAnswer={handleSubmitAnswer}
      onGenerateQuestions={interview.generateQuestions}
      onSave={handleSave}
      isSaving={interview.isSaving}
      savedInterviews={interview.savedInterviews}
      onLoadInterview={handleLoadInterview}
      onFetchList={interview.fetchInterviewList}
      bankQuestionGroups={interview.bankQuestionGroups}
      onAddBankGroup={interview.addBankGroup}
      onRemoveBankGroup={interview.removeBankGroup}
      onClearBankGroups={interview.clearBankGroups}
      wsStatus={ws.status}
      wsError={ws.error}
      audioError={audio.error}
      appError={interview.appError}
      onClearAppError={interview.clearAppError}
      onClearWsError={ws.clearError}
      onReconnect={handleReconnect}
      onSetJobRequirement={(jr) => {
        if (ws.status === 'connected') {
          ws.send({ type: 'control', action: 'set_job_requirement', job_requirement: jr });
        }
      }}
      voiceprintEnabled={voiceprintEnabled}
      onToggleVoiceprint={handleToggleVoiceprint}
      onManualRoleSwitch={handleManualRoleSwitch}
    />
  );
}

export default App;
