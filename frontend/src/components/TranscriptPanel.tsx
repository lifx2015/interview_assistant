import React, { useRef, useEffect } from 'react';
import type { InterviewStatus, SpeakerRole, TranscriptEntry } from '../types';

interface Props {
  status: InterviewStatus;
  transcript: TranscriptEntry[];
  currentPartial: string;
  currentRole: SpeakerRole;
}

export const TranscriptPanel: React.FC<Props> = ({
  status,
  transcript,
  currentPartial,
  currentRole,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentPartial]);

  // Debug: log to see if currentPartial is being received
  console.log('[TranscriptPanel] status:', status, 'currentPartial:', currentPartial, 'transcript.length:', transcript.length);

  return (
    <div className="transcript-area">
      {/* Always show status hint at top when empty or recording */}
      {transcript.length === 0 && !currentPartial && (
        <div className="transcript-empty">
          {status === 'recording'
            ? `聆听${currentRole === 'interviewer' ? '面试官' : '候选人'}中...`
            : status === 'paused' ? '已暂停' : '等待开始录音'}
        </div>
      )}

      {/* Show partial text prominently when recording */}
      {status === 'recording' && currentPartial && (
        <div className="partial-hint">
          正在识别: <span className="partial-text">{currentPartial}</span>
        </div>
      )}

      {transcript.map((entry) => (
        <div key={entry.id} className={`bubble ${entry.role} animate-fade-in-up`}>
          <span className="bubble-label">{entry.role === 'interviewer' ? '面试官' : '候选人'}</span>
          <span className="bubble-text">{entry.text}</span>
        </div>
      ))}
      {currentPartial && (
        <div className={`bubble ${currentRole} partial`}>
          <span className="bubble-label">{currentRole === 'interviewer' ? '面试官' : '候选人'}</span>
          <span className="bubble-text typing-cursor">{currentPartial}</span>
        </div>
      )}
      <div ref={bottomRef} />

      <style>{`
        .transcript-area {
          flex: 1; overflow-y: auto; padding: 10px 14px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .transcript-empty {
          height: 100%; display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); font-size: 13px;
        }
        .partial-hint {
          padding: 8px 12px;
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .partial-hint .partial-text {
          color: var(--accent-cyan);
          font-weight: 500;
        }
        .bubble { max-width: 88%; padding: 8px 12px; border-radius: 10px; }
        .bubble.interviewer {
          align-self: flex-start; background: rgba(0,102,255,0.1);
          border: 1px solid rgba(0,102,255,0.15); border-bottom-left-radius: 3px;
        }
        .bubble.candidate {
          align-self: flex-end; background: rgba(0,255,136,0.06);
          border: 1px solid rgba(0,255,136,0.12); border-bottom-right-radius: 3px;
        }
        .bubble.partial { opacity: 0.7; }
        .bubble-label {
          display: block; font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;
        }
        .bubble.interviewer .bubble-label { color: #6699ff; }
        .bubble.candidate .bubble-label { color: var(--accent-green); }
        .bubble-text { font-size: 13px; line-height: 1.5; color: var(--text-primary); }
      `}</style>
    </div>
  );
};
