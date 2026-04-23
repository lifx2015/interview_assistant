import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';

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

// 固定角色和会话
const FIXED_ROLE = 'interviewer';
const FIXED_SESSION = 'global_interviewers';

export const VoiceprintManagementPage: React.FC = () => {
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('simple');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 音频捕获
  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    const blob = new Blob([pcmBuffer], { type: 'application/octet-stream' });
    audioChunksRef.current.push(blob);
  }, []);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  // 加载所有面试官声纹
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

  // 加载声纹识别渠道信息
  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/voiceprint/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.available_providers || []);
        setCurrentProvider(data.current_provider || 'simple');
      }
    } catch (e) {
      console.error('Failed to fetch providers:', e);
    }
  };

  // 切换声纹识别渠道
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

  // 开始录制声纹
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

  // 停止录制并上传
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

  // 删除声纹
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

  // 清除所有声纹
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

  // 返回面试页面
  const goToInterview = () => {
    window.location.href = '/';
  };

  return (
    <div className="voiceprint-page">
      <header className="page-header">
        <h1>🎤 声纹管理</h1>
        <button className="back-btn" onClick={goToInterview}>
          ← 返回面试
        </button>
      </header>

      <div className="page-content">
        {/* 左侧：录入新声纹 */}
        <div className="record-section">
          <h2>录入面试官声纹</h2>
          <p className="section-desc">录入后可在面试中自动识别面试官身份</p>

          {/* 渠道选择 */}
          <div className="form-group">
            <label>声纹识别渠道</label>
            <div className="provider-selector">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  className={`provider-btn ${currentProvider === provider.id ? 'active' : ''} ${!provider.available ? 'disabled' : ''}`}
                  onClick={() => provider.available && switchProvider(provider.id)}
                  disabled={!provider.available}
                  title={provider.reason || provider.description}
                >
                  <div className="provider-name">{provider.name}</div>
                  <div className="provider-desc">{provider.description}</div>
                  {!provider.available && <div className="provider-unavailable">{provider.reason}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
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
            className={`record-btn ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <>
                <span className="recording-dot" />
                录制中 {recordingSeconds}s / 10s
              </>
            ) : (
              <>🎙️ 开始录制声纹</>
            )}
          </button>

          {message && <div className="message">{message}</div>}
        </div>

        {/* 右侧：声纹列表 */}
        <div className="list-section">
          <div className="list-header">
            <h2>已录入面试官声纹 ({voiceprints.length})</h2>
            {voiceprints.length > 0 && (
              <button className="clear-btn" onClick={clearAllVoiceprints}>
                清除全部
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">加载中...</div>
          ) : voiceprints.length === 0 ? (
            <div className="empty">
              <p>暂无声纹记录</p>
              <p>请录入面试官声纹以启用自动识别</p>
            </div>
          ) : (
            <div className="voiceprint-list">
              {voiceprints.map((vp) => (
                <div key={vp.voice_id} className="voiceprint-card interviewer">
                  <div className="card-header">
                    <span className="role-badge interviewer">面试官</span>
                    <div className="card-actions">
                      {vp.provider && (
                        <span className="provider-tag">
                          {vp.provider === 'speechbrain' ? '🧠 SB' : '⚡ Simple'}
                        </span>
                      )}
                      <button
                        className="delete-btn"
                        onClick={() => deleteVoiceprint(vp.voice_id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="name">{vp.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .voiceprint-page {
          min-height: 100vh;
          background: var(--bg-primary, #0f1419);
          color: var(--text-primary, #e6e6e6);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          border-bottom: 1px solid var(--border-color, #2a2f3a);
          background: rgba(0, 0, 0, 0.3);
        }

        .page-header h1 {
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }

        .back-btn {
          padding: 10px 20px;
          border: 1px solid var(--border-color, #2a2f3a);
          border-radius: 8px;
          background: transparent;
          color: var(--text-primary, #e6e6e6);
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          border-color: var(--accent-cyan, #00d4ff);
          color: var(--accent-cyan, #00d4ff);
        }

        .page-content {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 40px;
          padding: 40px;
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (max-width: 1024px) {
          .page-content {
            grid-template-columns: 1fr;
          }
        }

        .record-section {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color, #2a2f3a);
          border-radius: 12px;
          padding: 30px;
        }

        .record-section h2 {
          font-size: 18px;
          margin: 0 0 8px 0;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color, #2a2f3a);
        }

        .section-desc {
          font-size: 12px;
          color: var(--text-secondary, #8b949e);
          margin: -8px 0 24px 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          color: var(--text-secondary, #8b949e);
          margin-bottom: 8px;
        }

        .form-group select,
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-color, #2a2f3a);
          border-radius: 8px;
          color: var(--text-primary, #e6e6e6);
          font-size: 14px;
        }

        .form-group select:focus,
        .form-group input:focus {
          outline: none;
          border-color: var(--accent-cyan, #00d4ff);
        }

        .provider-selector {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .provider-btn {
          padding: 12px 16px;
          border: 1px solid var(--border-color, #2a2f3a);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.2);
          color: var(--text-primary, #e6e6e6);
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .provider-btn:hover:not(.disabled) {
          border-color: var(--accent-cyan, #00d4ff);
          background: rgba(0, 212, 255, 0.05);
        }

        .provider-btn.active {
          border-color: var(--accent-cyan, #00d4ff);
          background: rgba(0, 212, 255, 0.1);
        }

        .provider-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: rgba(255, 255, 255, 0.02);
        }

        .provider-name {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .provider-desc {
          font-size: 11px;
          color: var(--text-secondary, #8b949e);
        }

        .provider-unavailable {
          font-size: 10px;
          color: var(--accent-red, #ff4466);
          margin-top: 4px;
        }

        .record-btn {
          width: 100%;
          padding: 16px;
          margin-top: 10px;
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 8px;
          background: rgba(0, 255, 136, 0.1);
          color: var(--accent-green, #00ff88);
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .record-btn:hover:not(:disabled) {
          border-color: var(--accent-green, #00ff88);
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.2);
        }

        .record-btn.recording {
          border-color: var(--accent-red, #ff4466);
          background: rgba(255, 68, 102, 0.1);
          color: var(--accent-red, #ff4466);
          animation: pulse 1.5s ease-in-out infinite;
        }

        .recording-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent-red, #ff4466);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .message {
          margin-top: 16px;
          padding: 12px;
          border-radius: 8px;
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
          color: var(--accent-cyan, #00d4ff);
          font-size: 13px;
          text-align: center;
        }

        .list-section {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color, #2a2f3a);
          border-radius: 12px;
          padding: 30px;
        }

        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color, #2a2f3a);
        }

        .list-header h2 {
          font-size: 18px;
          margin: 0;
        }

        .clear-btn {
          padding: 8px 16px;
          border: 1px solid rgba(255, 68, 102, 0.3);
          border-radius: 6px;
          background: transparent;
          color: var(--accent-red, #ff4466);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-btn:hover {
          border-color: var(--accent-red, #ff4466);
          background: rgba(255, 68, 102, 0.1);
        }

        .loading,
        .empty {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-secondary, #8b949e);
        }

        .empty p {
          margin: 8px 0;
        }

        .voiceprint-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .voiceprint-card {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-color, #2a2f3a);
          border-radius: 10px;
          padding: 16px;
          transition: all 0.2s;
        }

        .voiceprint-card:hover {
          border-color: var(--border-glow, #3a3f4a);
          transform: translateY(-2px);
        }

        .voiceprint-card.interviewer {
          border-left: 3px solid #6699ff;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .provider-tag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(0, 212, 255, 0.15);
          color: var(--accent-cyan, #00d4ff);
        }

        .role-badge {
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .role-badge.interviewer {
          background: rgba(102, 153, 255, 0.15);
          color: #6699ff;
        }

        .delete-btn {
          padding: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          opacity: 0.6;
          transition: all 0.2s;
        }

        .delete-btn:hover {
          opacity: 1;
          transform: scale(1.1);
        }

        .card-body .name {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary, #e6e6e6);
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};
