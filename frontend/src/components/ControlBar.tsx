import React from 'react';
import type { InterviewStatus } from '../types';

interface Props {
  status: InterviewStatus;
  isAnalyzing: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSubmitAnswer: () => void;
}

export const ControlBar: React.FC<Props> = ({
  status,
  isAnalyzing,
  onStart,
  onPause,
  onResume,
  onStop,
  onSubmitAnswer,
}) => {
  return (
    <div className="control-bar">
      <div className="control-left">
        {status === 'idle' && (
          <button className="btn btn-start" onClick={onStart}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
            开始录音
          </button>
        )}
        {status === 'recording' && (
          <>
            <button className="btn btn-pause" onClick={onPause}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              暂停
            </button>
            <button className="btn btn-primary" onClick={onSubmitAnswer} disabled={isAnalyzing}>
              {isAnalyzing ? '分析中...' : '回答完毕，生成追问'}
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button className="btn btn-start" onClick={onResume}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              继续
            </button>
            <button className="btn btn-primary" onClick={onSubmitAnswer} disabled={isAnalyzing}>
              {isAnalyzing ? '分析中...' : '回答完毕，生成追问'}
            </button>
          </>
        )}
        {status === 'analyzing' && (
          <div className="analyzing-indicator">
            <div className="analyzing-dots">
              <span /><span /><span />
            </div>
            AI 分析中...
          </div>
        )}
      </div>

      <div className="control-right">
        {status !== 'idle' && (
          <button className="btn btn-stop" onClick={onStop}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            结束
          </button>
        )}
      </div>

      <style>{`
        .control-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.2);
        }
        .control-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .control-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .analyzing-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--accent-cyan);
          font-size: 14px;
        }
        .analyzing-dots {
          display: flex;
          gap: 4px;
        }
        .analyzing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-cyan);
          animation: pulse-dot 1s ease-in-out infinite;
        }
        .analyzing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .analyzing-dots span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
};
