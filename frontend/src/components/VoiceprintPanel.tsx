import React, { useState, useRef, useCallback } from 'react';
import { useAudioCapture } from '../hooks/useAudioCapture';

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
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 音频捕获
  const handleAudioData = useCallback((pcmBuffer: ArrayBuffer) => {
    // 将 PCM 转换为 Blob 存储
    const blob = new Blob([pcmBuffer], { type: 'application/octet-stream' });
    audioChunksRef.current.push(blob);
  }, []);

  const audio = useAudioCapture({ onAudioData: handleAudioData });

  // 加载当前会话的声纹列表
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

  // 开始录制声纹
  const startRecording = async () => {
    if (!recordingName.trim()) {
      alert('请输入姓名');
      return;
    }

    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setIsRecording(true);

    // 启动音频捕获
    await audio.start();

    // 计时器
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => {
        if (s >= 10) {
          // 最多录制10秒
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

    // 合并音频数据
    const audioBlob = new Blob(audioChunksRef.current, { type: 'application/octet-stream' });

    if (audioBlob.size < 16000) {
      alert('录制时间太短，请至少录制2秒');
      return;
    }

    // 上传声纹
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
        const data = await res.json();
        console.log('Voiceprint registered:', data);
        await fetchVoiceprints();
        setRecordingName('');
      } else {
        const err = await res.json();
        alert(`注册失败: ${err.detail || '未知错误'}`);
      }
    } catch (e) {
      console.error('Failed to register voiceprint:', e);
      alert('注册失败，请重试');
    }
  };

  // 删除声纹
  const deleteVoiceprint = async (voiceId: string) => {
    if (!confirm('确定要删除这个声纹吗？')) return;

    try {
      const res = await fetch(`/api/voiceprint/delete/${voiceId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchVoiceprints();
      }
    } catch (e) {
      console.error('Failed to delete voiceprint:', e);
    }
  };

  // 清除所有声纹
  const clearAllVoiceprints = async () => {
    if (!confirm('确定要清除当前会话的所有声纹吗？')) return;

    try {
      const res = await fetch(`/api/voiceprint/clear/${sessionId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchVoiceprints();
      }
    } catch (e) {
      console.error('Failed to clear voiceprints:', e);
    }
  };

  return (
    <div className="voiceprint-panel">
      <h3 className="panel-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        声纹管理
      </h3>

      {/* 已注册的声纹列表 */}
      <div className="voiceprint-list">
        {voiceprints.length === 0 ? (
          <div className="empty-text">暂无注册声纹，请先录制</div>
        ) : (
          voiceprints.map((vp) => (
            <div key={vp.voice_id} className={`voiceprint-item ${vp.role}`}>
              <span className="role-badge">{vp.role === 'interviewer' ? '面试官' : '候选人'}</span>
              <span className="name">{vp.name}</span>
              <button className="delete-btn" onClick={() => deleteVoiceprint(vp.voice_id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* 录制新声纹 */}
      <div className="record-section">
        <div className="input-group">
          <select
            value={recordingRole}
            onChange={(e) => setRecordingRole(e.target.value as 'interviewer' | 'candidate')}
            disabled={isRecording}
          >
            <option value="interviewer">面试官</option>
            <option value="candidate">候选人</option>
          </select>
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
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
              录制声纹
            </>
          )}
        </button>

        {voiceprints.length > 0 && (
          <button className="clear-btn" onClick={clearAllVoiceprints}>
            清除所有声纹
          </button>
        )}
      </div>

      <style>{`
        .voiceprint-panel {
          padding: 12px;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: var(--text-primary);
        }
        .voiceprint-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
          max-height: 120px;
          overflow-y: auto;
        }
        .empty-text {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          padding: 12px;
        }
        .voiceprint-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          font-size: 12px;
        }
        .voiceprint-item.interviewer {
          border-left: 2px solid #6699ff;
        }
        .voiceprint-item.candidate {
          border-left: 2px solid var(--accent-green);
        }
        .role-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,255,255,0.1);
          color: var(--text-secondary);
        }
        .name {
          flex: 1;
          color: var(--text-primary);
        }
        .delete-btn {
          padding: 4px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .delete-btn:hover {
          color: var(--accent-red);
          background: rgba(255,68,102,0.1);
        }
        .record-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .input-group {
          display: flex;
          gap: 8px;
        }
        .input-group select,
        .input-group input {
          flex: 1;
          padding: 6px 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 12px;
        }
        .input-group select:focus,
        .input-group input:focus {
          outline: none;
          border-color: var(--accent-cyan);
        }
        .record-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 16px;
          border: 1px solid rgba(0,255,136,0.3);
          border-radius: 6px;
          background: rgba(0,255,136,0.06);
          color: var(--accent-green);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .record-btn:hover:not(:disabled) {
          border-color: var(--accent-green);
          box-shadow: 0 0 12px rgba(0,255,136,0.15);
        }
        .record-btn.recording {
          border-color: var(--accent-red);
          background: rgba(255,68,102,0.1);
          color: var(--accent-red);
          animation: pulse 1s ease-in-out infinite;
        }
        .recording-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-red);
        }
        .clear-btn {
          padding: 6px 12px;
          border: 1px solid rgba(255,68,102,0.3);
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .clear-btn:hover {
          border-color: var(--accent-red);
          color: var(--accent-red);
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
