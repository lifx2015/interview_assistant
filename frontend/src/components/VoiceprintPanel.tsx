import React, { useState, useRef, useCallback } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';
import styles from './VoiceprintPanel.module.css';

interface Voiceprint {
  voice_id: string;
  role: 'interviewer' | 'candidate';
  name: string;
}

interface Props {
  sessionId: string;
  onVoiceprintRegistered?: (voiceprints: Voiceprint[]) => void;
}

export const VoiceprintPanel: React.FC<Props> = ({ sessionId, onVoiceprintRegistered }) => {
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingRole, setRecordingRole] = useState<'interviewer' | 'candidate'>('interviewer');
  const [recordingName, setRecordingName] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [message, setMessage] = useState('');
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    const blob = new Blob([pcmBuffer], { type: 'application/octet-stream' });
    audioChunksRef.current.push(blob);
  }, []);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  const fetchVoiceprints = useCallback(async () => {
    try {
      const res = await fetch(`/api/voiceprint/list/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setVoiceprints(data.voiceprints || []);
        onVoiceprintRegistered?.(data.voiceprints || []);
      }
    } catch (e) {
      console.error('Failed to fetch voiceprints:', e);
    }
  }, [sessionId, onVoiceprintRegistered]);

  const startRecording = async () => {
    if (!recordingName.trim()) {
      setMessage('请输入姓名');
      return;
    }

    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setIsRecording(true);
    setMessage('');

    await audio.start();

    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => {
        if (s >= 10) {
          stopRecording();
          return s;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    audio.stop();
    setIsRecording(false);

    const audioBlob = new Blob(audioChunksRef.current, { type: 'application/octet-stream' });

    if (audioBlob.size < 16000) {
      setMessage('录制时间太短，请至少录制2秒');
      return;
    }

    const voiceId = `${recordingRole}_${Date.now()}`;
    const formData = new FormData();
    formData.append('voice_id', voiceId);
    formData.append('role', recordingRole);
    formData.append('name', recordingName);
    formData.append('session_id', sessionId);
    formData.append('audio_file', audioBlob, 'voiceprint.pcm');

    try {
      const res = await fetch('/api/voiceprint/enroll', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setMessage(`声纹注册成功: ${recordingName}`);
        await fetchVoiceprints();
        setRecordingName('');
      } else {
        const err = await res.json();
        setMessage(`注册失败: ${err.detail || '未知错误'}`);
      }
    } catch (e) {
      console.error('Failed to register voiceprint:', e);
      setMessage('注册失败，请重试');
    }
  };

  const deleteVoiceprint = async (voiceId: string) => {
    try {
      const res = await fetch(`/api/voiceprint/delete/${voiceId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchVoiceprints();
      }
    } catch (e) {
      console.error('Failed to delete voiceprint:', e);
    }
  };

  return (
    <div className={styles['voiceprint-panel']}>
      <div className={styles['section-title']}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        声纹管理
      </div>

      <div className={styles['voiceprint-list']}>
        {voiceprints.length === 0 ? (
          <div className={styles['empty-state']}>暂无注册声纹，请先录制</div>
        ) : (
          voiceprints.map((vp) => (
            <div key={vp.voice_id} className={styles['voiceprint-card']}>
              <div className={styles['voiceprint-info']}>
                <span className={`${styles['role-badge']} ${styles[vp.role]}`}>
                  {vp.role === 'interviewer' ? '面试官' : '候选人'}
                </span>
                <span className={styles['voiceprint-name']}>{vp.name}</span>
              </div>
              <button className={styles['delete-btn']} onClick={() => deleteVoiceprint(vp.voice_id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      <div className={styles['record-section']}>
        <input
          className={styles['name-input']}
          type="text"
          placeholder="输入姓名"
          value={recordingName}
          onChange={(e) => setRecordingName(e.target.value)}
          disabled={isRecording}
        />
        <button
          className={`${styles['record-btn']} ${isRecording ? styles.recording : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? (
            <>
              <span className={styles['recording-dot']} />
              录制中 {recordingSeconds}s / 10s
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
              录制声纹
            </>
          )}
        </button>
      </div>

      {message && <div className={styles.message}>{message}</div>}
    </div>
  );
};