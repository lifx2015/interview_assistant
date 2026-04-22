import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  analysisRaw: string;
  incrementalRaw: string;
  isAnalyzing: boolean;
}

export const AnalysisPanel: React.FC<Props> = ({
  analysisRaw, incrementalRaw, isAnalyzing,
}) => {
  const hasIncremental = incrementalRaw.length > 0;
  const hasFinal = analysisRaw.length > 0 && !hasIncremental;
  const isStreaming = isAnalyzing && !analysisRaw;

  const displayText = hasIncremental ? incrementalRaw : hasFinal ? analysisRaw : '';

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>{hasFinal ? '深度分析' : '实时分析'}</span>
        {(hasIncremental || isStreaming) && <span className="live-badge"><span className="live-dot-sm" />实时</span>}
      </div>

      <div className="analysis-body">
        {displayText ? (
          <MarkdownRenderer content={displayText} isStreaming={hasIncremental || isStreaming} />
        ) : (
          <div className="analysis-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p>候选人回答时将实时生成分析</p>
          </div>
        )}
      </div>

      <style>{`
        .analysis-panel { display: flex; flex-direction: column; height: 100%; }

        .analysis-header {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px; border-bottom: 1px solid var(--border-color);
          font-size: 12px; font-weight: 600; color: var(--text-primary); flex-shrink: 0;
        }
        .live-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 10px; color: var(--accent-cyan); margin-left: auto;
          padding: 2px 6px; border-radius: 8px;
          background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.2);
        }
        .live-dot-sm {
          width: 5px; height: 5px; border-radius: 50%; background: var(--accent-cyan);
          animation: pulse-dot 1s ease-in-out infinite;
        }

        .analysis-body { flex: 1; overflow-y: auto; padding: 10px 12px; }

        .analysis-empty {
          height: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
          color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;
        }
      `}</style>
    </div>
  );
};
