import React from 'react';
import type { CandidateInfo } from '../types';

interface Props {
  candidate: CandidateInfo;
}

export const CandidatePanel: React.FC<Props> = ({ candidate }) => {
  return (
    <div className="candidate-panel">
      {/* Header */}
      <div className="candidate-header">
        <div className="avatar">{candidate.name?.[0] || '?'}</div>
        <div className="header-info">
          <div className="name">{candidate.name || '未知'}</div>
          <div className="contacts">
            {candidate.phone && <span>{candidate.phone}</span>}
            {candidate.email && <span>{candidate.email}</span>}
          </div>
        </div>
      </div>

      {/* Summary */}
      {candidate.summary && (
        <div className="section">
          <div className="section-title">核心特点</div>
          <div className="summary-text">{candidate.summary}</div>
        </div>
      )}

      {/* Skills */}
      {candidate.skills.length > 0 && (
        <div className="section">
          <div className="section-title">技能标签</div>
          <div className="skill-tags">
            {candidate.skills.map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
          </div>
        </div>
      )}

      {/* Education */}
      {candidate.education.length > 0 && (
        <div className="section">
          <div className="section-title">教育背景</div>
          {candidate.education.map((e, i) => <div key={i} className="list-item">{e}</div>)}
        </div>
      )}

      {/* Work Experience */}
      {candidate.work_experience.length > 0 && (
        <div className="section">
          <div className="section-title">工作经历</div>
          {candidate.work_experience.map((w, i) => <div key={i} className="list-item">{w}</div>)}
        </div>
      )}

      {/* Risk Points */}
      {candidate.risk_points.length > 0 && (
        <div className="section">
          <div className="section-title risk-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            风险点
          </div>
          {candidate.risk_points.map((r, i) => (
            <div key={i} className="risk-item">
              <span className="risk-dot" />
              {r}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .candidate-panel { padding: 16px; overflow-y: auto; height: 100%; }
        .candidate-header {
          display: flex; align-items: center; gap: 12px;
          padding-bottom: 14px; margin-bottom: 14px;
          border-bottom: 1px solid var(--border-color);
        }
        .avatar {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; color: white;
        }
        .header-info { min-width: 0; }
        .name { font-size: 16px; font-weight: 600; }
        .contacts { font-size: 11px; color: var(--text-muted); display: flex; gap: 10px; margin-top: 2px; flex-wrap: wrap; }
        .section { margin-bottom: 14px; }
        .section-title {
          font-size: 11px; color: var(--accent-cyan); font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
          display: flex; align-items: center; gap: 6px;
        }
        .risk-title { color: var(--accent-amber); }
        .summary-text { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .list-item {
          font-size: 12px; color: var(--text-secondary); padding: 4px 0;
          border-bottom: 1px solid rgba(255,255,255,0.03); line-height: 1.5;
        }
        .skill-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .skill-tag {
          padding: 2px 8px; border-radius: 16px; font-size: 11px;
          background: rgba(0,212,255,0.08); color: var(--accent-cyan);
          border: 1px solid rgba(0,212,255,0.15);
        }
        .risk-item {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 12px; color: var(--accent-amber); padding: 5px 0; line-height: 1.5;
        }
        .risk-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--accent-amber);
          flex-shrink: 0; margin-top: 6px;
        }
      `}</style>
    </div>
  );
};
