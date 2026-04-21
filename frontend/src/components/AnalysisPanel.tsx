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
  // If no parsed data yet, show raw streaming text
  if (starFollowups.length === 0 && riskAssessments.length === 0 && rawText) {
    return (
      <div className="analysis-panel">
        <h3 className="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          AI 分析
        </h3>
        <div className="analysis-raw typing-cursor">{rawText}</div>

        <style>{`
          .analysis-panel { padding: 20px; height: 100%; overflow-y: auto; }
          .panel-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; margin-bottom: 20px; }
          .analysis-raw { font-size: 13px; color: var(--text-secondary); line-height: 1.7; white-space: pre-wrap; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      <h3 className="panel-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        AI 分析
      </h3>

      {starFollowups.length > 0 && (
        <div className="analysis-section animate-fade-in-up">
          <div className="section-label">STAR 追问</div>
          {starFollowups.map((item, i) => (
            <div key={i} className="star-card glow-card">
              <div className="star-header">
                <span className={`tag ${dimensionTagClass[item.dimension] || 'tag-situation'}`}>
                  {item.dimension}
                </span>
              </div>
              <div className="star-question">{item.question}</div>
              <div className="star-purpose">{item.purpose}</div>
            </div>
          ))}
        </div>
      )}

      {riskAssessments.length > 0 && (
        <div className="analysis-section animate-fade-in-up">
          <div className="section-label">风险评估</div>
          {riskAssessments.map((item, i) => (
            <div key={i} className="risk-card glow-card">
              <div className="risk-header">
                <span className={`risk-level ${riskLevelClass[item.risk_level] || 'risk-medium'}`}>
                  {item.risk_level.toUpperCase()}
                </span>
                <span className="risk-type">{item.risk_type}</span>
              </div>
              <div className="risk-desc">{item.description}</div>
              <div className="risk-suggestion">建议：{item.suggestion}</div>
            </div>
          ))}
        </div>
      )}

      {overallComment && (
        <div className="analysis-section animate-fade-in-up">
          <div className="section-label">总体评价</div>
          <div className="overall-comment glow-card">{overallComment}</div>
        </div>
      )}

      <style>{`
        .analysis-panel { padding: 20px; height: 100%; overflow-y: auto; }
        .panel-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; margin-bottom: 20px; }
        .analysis-section { margin-bottom: 20px; }
        .section-label {
          font-size: 12px; color: var(--accent-cyan); font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
        }
        .star-card { padding: 14px; margin-bottom: 8px; }
        .star-header { margin-bottom: 8px; }
        .star-question { font-size: 14px; color: var(--text-primary); line-height: 1.5; margin-bottom: 4px; }
        .star-purpose { font-size: 12px; color: var(--text-muted); }
        .risk-card { padding: 14px; margin-bottom: 8px; }
        .risk-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .risk-level { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
        .risk-type { font-size: 13px; color: var(--text-secondary); }
        .risk-desc { font-size: 13px; color: var(--text-primary); line-height: 1.5; margin-bottom: 6px; }
        .risk-suggestion { font-size: 12px; color: var(--text-muted); }
        .overall-comment { padding: 14px; font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
      `}</style>
    </div>
  );
};
