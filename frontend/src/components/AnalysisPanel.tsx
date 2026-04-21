import React from 'react';
import type { StarFollowUp, RiskAssessment } from '../types';

interface Props {
  starFollowups: StarFollowUp[];
  riskAssessments: RiskAssessment[];
  overallComment: string;
  rawText?: string;
}

const dimensionTagClass: Record<string, string> = {
  Situation: 'tag-situation',
  Task: 'tag-task',
  Action: 'tag-action',
  Result: 'tag-result',
};

const riskLevelClass: Record<string, string> = {
  low: 'risk-low',
  medium: 'risk-medium',
  high: 'risk-high',
};

export const AnalysisPanel: React.FC<Props> = ({
  starFollowups,
  riskAssessments,
  overallComment,
  rawText,
}) => {
  // Streaming mode: show raw text while LLM is generating
  if (starFollowups.length === 0 && riskAssessments.length === 0 && rawText) {
    return (
      <div className="analysis-panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
            追问与风险
          </h3>
        </div>
        <div className="analysis-raw typing-cursor">{rawText}</div>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      <div className="panel-header">
        <h3 className="panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          追问与风险
        </h3>
      </div>

      <div className="analysis-scroll">
        {starFollowups.length > 0 && (
          <div className="section animate-fade-in-up">
            <div className="section-label">STAR 追问</div>
            {starFollowups.map((item, i) => (
              <div key={i} className="star-card">
                <span className={`tag ${dimensionTagClass[item.dimension] || 'tag-situation'}`}>{item.dimension}</span>
                <div className="star-question">{item.question}</div>
                <div className="star-purpose">{item.purpose}</div>
              </div>
            ))}
          </div>
        )}

        {riskAssessments.length > 0 && (
          <div className="section animate-fade-in-up">
            <div className="section-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              风险评估
            </div>
            {riskAssessments.map((item, i) => (
              <div key={i} className="risk-card">
                <div className="risk-header">
                  <span className={`risk-level ${riskLevelClass[item.risk_level] || 'risk-medium'}`}>{item.risk_level.toUpperCase()}</span>
                  <span className="risk-type">{item.risk_type}</span>
                </div>
                <div className="risk-desc">{item.description}</div>
                <div className="risk-suggestion">建议：{item.suggestion}</div>
              </div>
            ))}
          </div>
        )}

        {overallComment && (
          <div className="section animate-fade-in-up">
            <div className="section-label">总体评价</div>
            <div className="overall-card">{overallComment}</div>
          </div>
        )}
      </div>

      <style>{`
        .analysis-panel { display: flex; flex-direction: column; height: 100%; }
        .panel-header { display: flex; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .panel-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
        .analysis-scroll { flex: 1; overflow-y: auto; padding: 10px 16px; }
        .analysis-raw { font-size: 12px; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; padding: 16px; }
        .section { margin-bottom: 14px; }
        .section-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;
          margin-bottom: 8px; display: flex; align-items: center; gap: 5px;
          color: var(--accent-cyan);
        }
        .star-card {
          padding: 10px 12px; margin-bottom: 6px; border-radius: var(--radius-sm);
          background: rgba(0,0,0,0.2); border: 1px solid var(--border-color);
        }
        .star-question { font-size: 13px; color: var(--text-primary); line-height: 1.5; margin: 6px 0 2px; }
        .star-purpose { font-size: 11px; color: var(--text-muted); }
        .risk-card {
          padding: 10px 12px; margin-bottom: 6px; border-radius: var(--radius-sm);
          background: rgba(0,0,0,0.2); border: 1px solid var(--border-color);
        }
        .risk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .risk-level { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
        .risk-type { font-size: 12px; color: var(--text-secondary); }
        .risk-desc { font-size: 12px; color: var(--text-primary); line-height: 1.5; margin-bottom: 4px; }
        .risk-suggestion { font-size: 11px; color: var(--text-muted); }
        .overall-card {
          padding: 10px 12px; border-radius: var(--radius-sm);
          background: rgba(0,0,0,0.2); border: 1px solid var(--border-color);
          font-size: 12px; color: var(--text-secondary); line-height: 1.6;
        }
      `}</style>
    </div>
  );
};
