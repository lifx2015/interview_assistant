import React from 'react';
import type { InterviewStatus, SpeakerRole } from '../types';

interface Props {
  status: InterviewStatus;
  currentRole: SpeakerRole;
  isAnalyzing: boolean;
  onSwitchRole: (role: SpeakerRole) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSubmitAnswer: () => void;
}

export const ControlBar: React.FC<Props> = ({
  status,
  currentRole,
  isAnalyzing,
  onSwitchRole,
  onStart,
  onPause,
  onResume,
  onStop,
  onSubmitAnswer,
}) => {
  return (
    <div className="control-bar">
      {/* Role switcher */}
      <div className="role-switcher">
        <button
          className={`role-btn ${currentRole === 'interviewer' ? 'active' : ''}`}
          onClick={() => onSwitchRole('interviewer')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          面试官
        </button>
        <button
          className={`role-btn candidate ${currentRole === 'candidate' ? 'active' : ''}`}
          onClick={() => onSwitchRole('candidate')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          候选人
        </button>
      </div>

      {/* Action buttons */}
      <div className="action-buttons">
        {status === 'idle' && (
          <button className="btn btn-start" onClick={onStart}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
            开始录音
          </button>
        )}
        {status === 'recording' && (
          <>
            <button className="btn btn-pause" onClick={onPause}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
              暂停
            </button>
            <button className="btn btn-primary" onClick={onSubmitAnswer} disabled={isAnalyzing}>
              {isAnalyzing ? '分析中...' : '回答完毕'}
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button className="btn btn-start" onClick={onResume}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              继续
            </button>
            <button className="btn btn-primary" onClick={onSubmitAnswer} disabled={isAnalyzing}>
              {isAnalyzing ? '分析中...' : '回答完毕'}
            </button>
          </>
        )}
        {status === 'analyzing' && (
          <div className="analyzing-indicator">
            <div className="analyzing-dots"><span /><span /><span /></div>
            AI 分析中...
          </div>
        )}
      </div>

      {/* Stop button */}
      <div className="stop-area">
        {status !== 'idle' && (
          <button className="btn btn-stop" onClick={onStop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
            关闭
          </button>
        )}
      </div>

      <style>{`
        .control-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px; border-top: 1px solid var(--border-color);
          background: rgba(0,0,0,0.25); flex-shrink: 0;
        }
        .role-switcher { display: flex; gap: 0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-color); }
        .role-btn {
          display: flex; align-items: center; gap: 5px; padding: 6px 12px;
          font-size: 12px; font-weight: 500; border: none; background: transparent;
          color: var(--text-muted); cursor: pointer; transition: all 0.2s;
        }
        .role-btn:hover { color: var(--text-primary); }
        .role-btn.active { background: rgba(0,212,255,0.12); color: var(--accent-cyan); }
        .role-btn.candidate.active { background: rgba(0,255,136,0.1); color: var(--accent-green); }
        .action-buttons { display: flex; align-items: center; gap: 8px; }
        .stop-area { display: flex; align-items: center; }
        .analyzing-indicator { display: flex; align-items: center; gap: 8px; color: var(--accent-cyan); font-size: 13px; }
        .analyzing-dots { display: flex; gap: 3px; }
        .analyzing-dots span { width: 5px; height: 5px; border-radius: 50%; background: var(--accent-cyan); animation: pulse-dot 1s ease-in-out infinite; }
        .analyzing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .analyzing-dots span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
};
