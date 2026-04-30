import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { voiceprintApi } from '../services/api';
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

export const VoiceprintManagementPage: React.FC = () => {
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('ecapa');
  const [recordingName, setRecordingName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // WebSocket-based real-time registration
  const wsRef = useRef<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio capture: send PCM directly to WebSocket (same path as real-time identification)
  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(pcmBuffer);
    }
  }, []);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  const fetchAllVoiceprints = async () => {
    setLoading(true);
    try {
      const data = await voiceprintApi.list();
      setVoiceprints(data.voiceprints || []);
    } catch (e) {
      console.error('Failed to fetch voiceprints:', e);
    }
    setLoading(false);
  };

  const fetchProviders = async () => {
    try {
      const data = await voiceprintApi.providers();
      setProviders(data.available_providers || []);
      setCurrentProvider(data.current_provider || 'ecapa');
    } catch (e) {
      console.error('Failed to fetch providers:', e);
    }
  };

  const switchProvider = async (providerId: string) => {
    try {
      const data = await voiceprintApi.switchProvider(providerId);
      setCurrentProvider(providerId);
      setMessage(`已切换到: ${data.provider}`);
      fetchProviders();
    } catch (e) {
      console.error('Failed to switch provider:', e);
      setMessage('切换失败，请重试');
    }
  };

  useEffect(() => {
    fetchAllVoiceprints();
    fetchProviders();
  }, []);

  // Disconnect WebSocket on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const connectWs = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/voiceprint-enroll`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('[VoiceprintPage] WebSocket connected');
        resolve(ws);
      };

      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'voiceprint_enroll_start') {
            setMessage('请说话，正在通过实时音频流注册声纹...');
          } else if (data.type === 'voiceprint_enroll_result') {
            if (data.success) {
              setMessage('实时声纹注册成功！');
              setRecordingName('');
              fetchAllVoiceprints();
            } else {
              setMessage(`实时注册失败: ${data.message || '未知错误'}`);
            }
            stopRecording();
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        console.log('[VoiceprintPage] WebSocket closed');
      };

      ws.onerror = () => {
        setMessage('WebSocket 连接失败，请检查后端是否运行');
        reject(new Error('WebSocket connection failed'));
      };

      wsRef.current = ws;
    });
  };

  const startRecording = async () => {
    if (!recordingName.trim()) {
      setMessage('请输入姓名');
      return;
    }

    try {
      const ws = await connectWs();

      setMessage('正在连接音频流...');
      setRecordingSeconds(0);
      setIsRecording(true);

      // Start audio capture (AudioWorklet + Int16 PCM, same as real-time identification)
      await audio.start();

      // Send enroll command to backend
      ws.send(JSON.stringify({
        type: 'control',
        action: 'enroll_voiceprint',
        name: recordingName,
      }));

      // Timer for UI feedback (auto-stop at 10s)
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s >= 10) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setMessage('WebSocket 连接超时，请检查后端是否运行');
    }
  };

  const stopRecording = () => {
    stopTimer();
    audio.stop();
    setIsRecording(false);
    // Backend auto-completes when enough audio is accumulated
    // and sends voiceprint_enroll_result
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
                实时录制中 {recordingSeconds}s / 10s
              </>
            ) : (
              <>🎙️ 实时录制声纹</>
            )}
          </button>
          <p className={styles['realtime-hint']}>
            使用与面试识别完全相同的音频通道，注册后识别准确率更高
          </p>

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
                          {vp.provider?.toUpperCase() || 'ECAPA'}
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
