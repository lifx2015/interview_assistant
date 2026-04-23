import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  analysisRaw: string;
  incrementalRaw: string;
  isAnalyzing: boolean;
}

export const AnalysisPanel: React.FC<Props> = ({
  analysisRaw, isAnalyzing,
}) => {
  const hasContent = analysisRaw.length > 0;
  const isStreaming = isAnalyzing && !analysisRaw;

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span>面试评估</span>
        {isStreaming && <span className="live-badge"><span className="live-dot-sm" />生成中</span>}
      </div>

      <div className="analysis-body">
        {hasContent ? (
          <MarkdownRenderer content={analysisRaw} isStreaming={isStreaming} />
        ) : (
          <div className="analysis-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p>面试结束后将自动生成评估报告</p>
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