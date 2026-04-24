import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';
import styles from './VoiceprintManagementPage.module.css';

interface Voiceprint {
  voice_id: string;
  role: 'interviewer';
  name: string;
  provider?: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  available: boolean;
  reason?: string;
}

const FIXED_ROLE = 'interviewer';
const FIXED_SESSION = 'global_interviewers';

export const VoiceprintManagementPage: React.FC = () => {
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('mfcc');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    const blob = new Blob([pcmBuffer], { type: 'application/octet-stream' });
    audioChunksRef.current.push(blob);
  }, []);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  const fetchAllVoiceprints = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/voiceprint/list');
      if (res.ok) {
        const data = await res.json();
        setVoiceprints(data.voiceprints || []);
      }
    } catch (e) {
      console.error('Failed to fetch voiceprints:', e);
    }
    setLoading(false);
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/voiceprint/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.available_providers || []);
        setCurrentProvider(data.current_provider || 'mfcc');
      }
    } catch (e) {
      console.error('Failed to fetch providers:', e);
    }
  };

  const switchProvider = async (providerId: string) => {
    try {
      const res = await fetch('/api/voiceprint/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentProvider(providerId);
        setMessage(`已切换到: ${data.provider}`);
        fetchProviders();
      } else {
        const err = await res.json();
        setMessage(`切换失败: ${err.detail || '未知错误'}`);
      }
    } catch (e) {
      console.error('Failed to switch provider:', e);
      setMessage('切换失败，请重试');
    }
  };

  useEffect(() => {
    fetchAllVoiceprints();
    fetchProviders();
  }, []);

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

    const voiceId = `interviewer_${Date.now()}`;
    const formData = new FormData();
    formData.append('voice_id', voiceId);
    formData.append('role', FIXED_ROLE);
    formData.append('name', recordingName);
    formData.append('session_id', FIXED_SESSION);
    formData.append('audio_file', audioBlob, 'voiceprint.pcm');

    try {
      const res = await fetch('/api/voiceprint/enroll', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setMessage(`面试官声纹注册成功: ${recordingName}`);
        setRecordingName('');
        fetchAllVoiceprints();
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
      const res = await fetch(`/api/voiceprint/delete/${voiceId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('声纹已删除');
        fetchAllVoiceprints();
      }
    } catch (e) {
      console.error('Failed to delete voiceprint:', e);
    }
  };

  const clearAllVoiceprints = async () => {
    if (!confirm('确定要清除所有面试官声纹吗？')) return;

    try {
      const res = await fetch('/api/voiceprint/clear', {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('已清除所有声纹');
        fetchAllVoiceprints();
      }
    } catch (e) {
      console.error('Failed to clear voiceprints:', e);
    }
  };

  const goToInterview = () => {
    window.location.href = '/';
  };

  return (
    <div className={styles['voiceprint-page']}>
      <header className={styles['page-header']}>
        <h1>🎤 声纹管理</h1>
        <button className={styles['back-btn']} onClick={goToInterview}>
          ← 返回面试
        </button>
      </header>

      <div className={styles['page-content']}>
        <div className={styles['record-section']}>
          <h2>录入面试官声纹</h2>
          <p className={styles['section-desc']}>录入后可在面试中自动识别面试官身份</p>

          <div className={styles['form-group']}>
            <label>声纹识别渠道</label>
            <div className={styles['provider-selector']}>
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  className={`${styles['provider-btn']} ${currentProvider === provider.id ? styles.active : ''} ${!provider.available ? styles.disabled : ''}`}
                  onClick={() => provider.available && switchProvider(provider.id)}
                  disabled={!provider.available}
                  title={provider.reason || provider.description}
                >
                  <div className={styles['provider-name']}>{provider.name}</div>
                  <div className={styles['provider-desc']}>{provider.description}</div>
                  {!provider.available && <div className={styles['provider-unavailable']}>{provider.reason}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className={styles['form-group']}>
            <label>面试官姓名</label>
            <input
              type="text"
              placeholder="输入面试官姓名"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              disabled={isRecording}
            />
          </div>

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
              <>🎙️ 开始录制声纹</>
            )}
          </button>

          {message && <div className={styles.message}>{message}</div>}
        </div>

        <div className={styles['list-section']}>
          <div className={styles['list-header']}>
            <h2>已录入面试官声纹 ({voiceprints.length})</h2>
            {voiceprints.length > 0 && (
              <button className={styles['clear-btn']} onClick={clearAllVoiceprints}>
                清除全部
              </button>
            )}
          </div>

          {loading ? (
            <div className={styles.loading}>加载中...</div>
          ) : voiceprints.length === 0 ? (
            <div className={styles.empty}>
              <p>暂无声纹记录</p>
              <p>请录入面试官声纹以启用自动识别</p>
            </div>
          ) : (
            <div className={styles['voiceprint-list']}>
              {voiceprints.map((vp) => (
                <div key={vp.voice_id} className={`${styles['voiceprint-card']} ${styles.interviewer}`}>
                  <div className={styles['card-header']}>
                    <span className={`${styles['role-badge']} ${styles.interviewer}`}>面试官</span>
                    <div className={styles['card-actions']}>
                      {vp.provider && (
                        <span className={styles['provider-tag']}>
                          MFCC
                        </span>
                      )}
                      <button
                        className={styles['delete-btn']}
                        onClick={() => deleteVoiceprint(vp.voice_id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className={styles['card-body']}>
                    <div className={styles.name}>{vp.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};