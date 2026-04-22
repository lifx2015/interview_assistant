import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';

interface Voiceprint {
  voice_id: string;
  role: 'interviewer' | 'candidate';
  name: string;
  session_id: string;
}

interface Session {
  session_id: string;
  candidate_name: string;
  created_at: string;
}

export const VoiceprintManagementPage: React.FC = () => {
  const [voiceprints, setVoiceprints] = useState<Voiceprint[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingRole, setRecordingRole] = useState<'interviewer' | 'candidate'>('interviewer');
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

  // 加载会话列表
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/interview/list');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  };

  // 加载所有声纹
  const fetchAllVoiceprints = async () => {
    setLoading(true);
    try {
      // 获取所有会话的声纹
      const allVoiceprints: Voiceprint[] = [];
      for (const session of sessions) {
        const res = await fetch(`/api/voiceprint/list/${session.session_id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.voiceprints) {
            allVoiceprints.push(...data.voiceprints);
          }
        }
      }
      setVoiceprints(allVoiceprints);
    } catch (e) {
      console.error('Failed to fetch voiceprints:', e);
    }
    setLoading(false);
  };

  // 加载指定会话的声纹
  const fetchSessionVoiceprints = async (sessionId: string) => {
    if (!sessionId) {
      setVoiceprints([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/voiceprint/list/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setVoiceprints(data.voiceprints || []);
      }
    } catch (e) {
      console.error('Failed to fetch voiceprints:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionVoiceprints(selectedSessionId);
    } else {
      fetchAllVoiceprints();
    }
  }, [selectedSessionId, sessions]);

  // 开始录制声纹
  const startRecording = async () => {
    if (!recordingName.trim()) {
      setMessage('请输入姓名');
      return;
    }
    if (!selectedSessionId) {
      setMessage('请先选择会话');
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

    const voiceId = `${recordingRole}_${Date.now()}`;
    const formData = new FormData();
    formData.append('voice_id', voiceId);
    formData.append('role', recordingRole);
    formData.append('name', recordingName);
    formData.append('session_id', selectedSessionId);
    formData.append('audio_file', audioBlob, 'voiceprint.pcm');

    try {
      const res = await fetch('/api/voiceprint/enroll', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setMessage(`声纹注册成功: ${recordingName}`);
        setRecordingName('');
        fetchSessionVoiceprints(selectedSessionId);
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
  const deleteVoiceprint = async (voiceId: string, sessionId: string) => {
    try {
      const res = await fetch(`/api/voiceprint/delete/${voiceId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('声纹已删除');
        if (selectedSessionId) {
          fetchSessionVoiceprints(selectedSessionId);
        } else {
          fetchAllVoiceprints();
        }
      }
    } catch (e) {
      console.error('Failed to delete voiceprint:', e);
    }
  };

  // 清除会话的所有声纹
  const clearSessionVoiceprints = async () => {
    if (!selectedSessionId) return;
    if (!confirm('确定要清除当前会话的所有声纹吗？')) return;

    try {
      const res = await fetch(`/api/voiceprint/clear/${selectedSessionId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('已清除所有声纹');
        fetchSessionVoiceprints(selectedSessionId);
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
          <h2>录入新声纹</h2>

          <div className="form-group">
            <label>选择会话</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              <option value="">全部会话</option>
              {sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.candidate_name} ({new Date(s.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>角色</label>
            <div className="role-selector">
              <button
                className={recordingRole === 'interviewer' ? 'active' : ''}
                onClick={() => setRecordingRole('interviewer')}
              >
                面试官
              </button>
              <button
                className={recordingRole === 'candidate' ? 'active' : ''}
                onClick={() => setRecordingRole('candidate')}
              >
                候选人
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>姓名</label>
            <input
              type="text"
              placeholder="输入姓名"
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
            <h2>已录入声纹 ({voiceprints.length})</h2>
            {selectedSessionId && voiceprints.length > 0 && (
              <button className="clear-btn" onClick={clearSessionVoiceprints}>
                清除全部
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">加载中...</div>
          ) : voiceprints.length === 0 ? (
            <div className="empty">
              <p>暂无声纹记录</p>
              <p>请先选择会话并录入声纹</p>
            </div>
          ) : (
            <div className="voiceprint-list">
              {voiceprints.map((vp) => (
                <div key={vp.voice_id} className={`voiceprint-card ${vp.role}`}>
                  <div className="card-header">
                    <span className={`role-badge ${vp.role}`}>
                      {vp.role === 'interviewer' ? '面试官' : '候选人'}
                    </span>
                    <button
                      className="delete-btn"
                      onClick={() => deleteVoiceprint(vp.voice_id, vp.session_id)}
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="name">{vp.name}</div>
                    <div className="session-id">会话: {vp.session_id.slice(0, 8)}...</div>
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
          margin: 0 0 24px 0;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color, #2a2f3a);
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

        .role-selector {
          display: flex;
          gap: 12px;
        }

        .role-selector button {
          flex: 1;
          padding: 12px 20px;
          border: 1px solid var(--border-color, #2a2f3a);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          color: var(--text-secondary, #8b949e);
          cursor: pointer;
          transition: all 0.2s;
        }

        .role-selector button.active {
          border-color: var(--accent-cyan, #00d4ff);
          background: rgba(0, 212, 255, 0.1);
          color: var(--accent-cyan, #00d4ff);
        }

        .role-selector button.active.interviewer {
          border-color: #6699ff;
          background: rgba(102, 153, 255, 0.1);
          color: #6699ff;
        }

        .role-selector button.active.candidate {
          border-color: var(--accent-green, #00ff88);
          background: rgba(0, 255, 136, 0.1);
          color: var(--accent-green, #00ff88);
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

        .voiceprint-card.candidate {
          border-left: 3px solid var(--accent-green, #00ff88);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
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

        .role-badge.candidate {
          background: rgba(0, 255, 136, 0.15);
          color: var(--accent-green, #00ff88);
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

        .card-body .session-id {
          font-size: 11px;
          color: var(--text-secondary, #8b949e);
        }
      `}</style>
    </div>
  );
};
