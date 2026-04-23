import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import styles from './AnalysisPanel.module.css';

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
    <div className={styles['analysis-panel']}>
      <div className={styles['analysis-header']}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span>面试评估</span>
        {isStreaming && <span className={styles['live-badge']}><span className={styles['live-dot-sm']} />生成中</span>}
      </div>

      <div className={styles['analysis-body']}>
        {hasContent ? (
          <MarkdownRenderer content={analysisRaw} isStreaming={isStreaming} />
        ) : (
          <div className={styles['analysis-empty']}>
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
    </div>
  );
};