import React from 'react';

export const RecordingIndicator: React.FC = () => {
  return (
    <div className="recording-indicator recording-pulse">
      <div className="recording-dot-inner recording-dot" />
      <span>录音中</span>

      <style>{`
        .recording-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          background: rgba(255, 68, 102, 0.1);
          border: 1px solid rgba(255, 68, 102, 0.3);
          font-size: 12px;
          color: var(--accent-red);
          font-weight: 600;
        }
        .recording-dot-inner {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-red);
        }
      `}</style>
    </div>
  );
};
