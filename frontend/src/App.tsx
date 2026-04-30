import React, { useCallback, useRef, useState, useEffect } from 'react';
import { MainLayout } from './components/MainLayout';
import { useInterview } from './hooks/useInterview';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useSystemAudioCapture } from './hooks/useSystemAudioCapture';
import type { InterviewStatus, InterviewMode } from './types';
import './styles/global.css';
import './styles/animations.css';
import './styles/markdown.css';

function App() {
  const interview = useInterview();
  const audioStartedRef = useRef(false);
  const [noteContent, setNoteContent] = useState('');
  const prevStatusRef = useRef<InterviewStatus>('idle');
  const [voiceprintEnabled, setVoiceprintEnabled] = useState(false);
  const [mode, setMode] = useState<InterviewMode>('dual-track');
  const [systemAudioError, setSystemAudioError] = useState<string | null>(null);

  const handleWSMessage = useCallback((data: any) => {
    console.log('[App] WS message received:', data.type, data);
    if (data.type === 'error') {
      interview.handleASRResult(data);
    } else if (data.type === 'role_switched') {
      if (data.detected_by === 'voiceprint') {
        console.log('[App] Voiceprint auto-switched role to:', data.role, 'confidence:', data.confidence);
      } else {
        console.log('[App] Manual role switch confirmed:', data.role);
      }
      interview.switchRole(data.role);
    } else if (data.type === 'voiceprint_status') {
      console.log('[App] Voiceprint status changed:', data.enabled);
      setVoiceprintEnabled(data.enabled);
    } else if (data.type === 'mode_status') {
      console.log('[App] Mode status:', data.mode, data.message);
    } else {
      interview.handleASRResult(data);
    }
  }, [interview.handleASRResult, interview.switchRole]);

  const ws = useWebSocket({
    url: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/asr/${interview.sessionId || 'pending'}`,
    onMessage: handleWSMessage,
    onOpen: () => {
      console.log('[App] WebSocket connected, waiting for voiceprint_status from backend');
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

  const systemAudio = useSystemAudioCapture((pcmData: ArrayBuffer) => {
    // Prefix with 0x02 for system audio (candidate)
    const tagged = new Uint8Array(1 + pcmData.byteLength);
    tagged[0] = 0x02;
    tagged.set(new Uint8Array(pcmData), 1);
    ws.sendBinary(tagged.buffer);
  });

  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    if (mode === 'dual-track') {
      // Prefix with 0x01 for microphone (interviewer)
      const tagged = new Uint8Array(1 + pcmBuffer.byteLength);
      tagged[0] = 0x01;
      tagged.set(new Uint8Array(pcmBuffer), 1);
      ws.sendBinary(tagged.buffer);
    } else {
      ws.sendBinary(pcmBuffer);
    }
  }, [ws.sendBinary, mode]);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  // P0-3: 等待 WebSocket 真正连接后再开始录音
  const [waitingForWs, setWaitingForWs] = useState(false);

  useEffect(() => {
    if (waitingForWs && ws.status === 'connected') {
      setWaitingForWs(false);
      audio.start().then(async () => {
        audioStartedRef.current = true;
        interview.startInterview();

        // Send set_mode control message after WebSocket is open
        ws.send({ type: 'control', action: 'set_mode', mode: mode });

        // Start system audio capture in dual-track mode
        if (mode === 'dual-track') {
          try {
            setSystemAudioError(null);
            await systemAudio.start();
          } catch (err) {
            // Fallback to single-track mode
            console.warn('[App] System audio capture failed, falling back to single-track:', err);
            setMode('single-track');
            setSystemAudioError(err instanceof Error ? err.message : '系统音频捕获失败');
            ws.send({ type: 'control', action: 'set_mode', mode: 'single-track' });
          }
        }
      }).catch((err) => {
        console.error('[App] Audio start failed:', err);
        setWaitingForWs(false);
        audioStartedRef.current = false;
      });
    }
  }, [waitingForWs, ws.status, audio, interview.startInterview, mode, systemAudio.start, ws.send]);

  const handleStart = useCallback(async () => {
    if (!interview.sessionId) return;
    ws.connect();
    setWaitingForWs(true);
  }, [interview.sessionId, ws.connect]);

  const handlePause = useCallback(() => {
    audio.pause();
    systemAudio.pause();
    ws.send({ type: 'control', action: 'pause' });
    interview.pauseInterview();
  }, [audio.pause, systemAudio.pause, ws.send, interview.pauseInterview]);

  const handleResume = useCallback(() => {
    audio.resume();
    systemAudio.resume();
    ws.send({ type: 'control', action: 'resume' });
    interview.resumeInterview();
  }, [audio.resume, systemAudio.resume, ws.send, interview.resumeInterview]);

  const handleStop = useCallback(() => {
    audio.stop();
    systemAudio.stop();
    ws.send({ type: 'control', action: 'stop' });
    interview.stopInterview();
  }, [audio, systemAudio.stop, ws, interview]);

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

  const handleModeChange = useCallback((newMode: InterviewMode) => {
    if (interview.status !== 'idle') return;
    setMode(newMode);
    setSystemAudioError(null);
  }, [interview.status]);

  return (
    <MainLayout
      candidate={interview.candidate}
      sessionId={interview.sessionId}
      status={interview.status}
      currentRole={interview.currentRole}
      transcript={interview.transcript}
      pendingSentences={interview.pendingSentences}
      currentPartial={interview.currentPartial}
      partialByRole={interview.partialByRole}
      isAnalyzing={interview.isAnalyzing}
      isGeneratingQuestions={interview.isGeneratingQuestions}
      questionsRaw={interview.questionsRaw}
      followUpRaw={interview.followUpRaw}
      lastFollowUpRaw={interview.lastFollowUpRaw}
      evaluationRaw={interview.evaluationRaw}
      isEvaluating={interview.isEvaluating}
      psychologyRaw={interview.psychologyRaw}
      isPsychologyAnalyzing={interview.isPsychologyAnalyzing}
      noteContent={noteContent}
      onNoteChange={setNoteContent}
      onUploadSuccess={interview.onUploadSuccess}
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
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
      onTriggerFollowUp={interview.triggerFollowUp}
      onTriggerPsychology={interview.triggerPsychology}
      voiceprintEnabled={voiceprintEnabled}
      mode={mode}
      onModeChange={handleModeChange}
      systemAudioError={systemAudioError}
    />
  );
}

export default App;
