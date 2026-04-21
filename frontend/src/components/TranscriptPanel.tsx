import React, { useRef, useEffect } from 'react';
import type { InterviewStatus } from '../types';

interface Props {
  status: InterviewStatus;
  transcript: Array<{ id: number; text: string; isFinal: boolean; timestamp: number }>;
  currentPartial: string;
  currentQuestion: string;
  onQuestionChange: (q: string) => void;
}

export const TranscriptPanel: React.FC<Props> = ({
  status,
  transcript,
  currentPartial,
  currentQuestion,
  onQuestionChange,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentPartial]);

  return (
    <div className="transcript-panel">
      <div className="question-input-area">
        <label className="question-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          当前面试问题
        </label>
        <textarea
          className="question-input"
          value={currentQuestion}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder="输入面试问题，或等待候选人回答后自动分析..."
          rows={2}
        />
      </div>

      <div className="transcript-area">
        {transcript.length === 0 && !currentPartial && (
          <div className="transcript-empty">
            {status === 'recording'
              ? '正在聆听...'
              : status === 'paused'
              ? '已暂停'
              : '等待开始录音'}
          </div>
        )}
        {transcript.map((entry) => (
          <div key={entry.id} className="transcript-line animate-fade-in-up">
            <span className="transcript-text">{entry.text}</span>
          </div>
        ))}
        {currentPartial && (
          <div className="transcript-line partial">
            <span className="transcript-text typing-cursor">{currentPartial}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`
        .transcript-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .question-input-area {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
        }
        .question-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--accent-cyan);
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .question-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          padding: 10px 14px;
          font-size: 14px;
          resize: none;
          outline: none;
          font-family: inherit;
          line-height: 1.5;
        }
        .question-input:focus {
          border-color: var(--border-glow);
        }
        .question-input::placeholder {
          color: var(--text-muted);
        }
        .transcript-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }
        .transcript-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 14px;
        }
        .transcript-line {
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .transcript-line.partial {
          opacity: 0.7;
        }
        .transcript-text {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
