import React from 'react';
import type { CandidateInfo } from '../types';

interface Props {
  candidate: CandidateInfo;
}

export const ResumePanel: React.FC<Props> = ({ candidate }) => {
  return (
    <div className="resume-panel">
      <h3 className="panel-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        候选人信息
      </h3>

      <div className="candidate-header">
        <div className="candidate-avatar">{candidate.name?.[0] || '?'}</div>
        <div>
          <div className="candidate-name">{candidate.name || '未知'}</div>
          <div className="candidate-contact">
            {candidate.phone && <span>{candidate.phone}</span>}
            {candidate.email && <span>{candidate.email}</span>}
          </div>
        </div>
      </div>

      {candidate.summary && (
        <div className="info-block">
          <div className="info-label">核心特点</div>
          <div className="info-text">{candidate.summary}</div>
        </div>
      )}

      {candidate.education.length > 0 && (
        <div className="info-block">
          <div className="info-label">教育背景</div>
          {candidate.education.map((e, i) => (
            <div key={i} className="info-item">{e}</div>
          ))}
        </div>
      )}

      {candidate.skills.length > 0 && (
        <div className="info-block">
          <div className="info-label">技能标签</div>
          <div className="skill-tags">
            {candidate.skills.map((s, i) => (
              <span key={i} className="skill-tag">{s}</span>
            ))}
          </div>
        </div>
      )}

      {candidate.work_experience.length > 0 && (
        <div className="info-block">
          <div className="info-label">工作经历</div>
          {candidate.work_experience.map((w, i) => (
            <div key={i} className="info-item">{w}</div>
          ))}
        </div>
      )}

      {candidate.projects.length > 0 && (
        <div className="info-block">
          <div className="info-label">项目经历</div>
          {candidate.projects.map((p, i) => (
            <div key={i} className="info-item">{p}</div>
          ))}
        </div>
      )}

      <style>{`
        .resume-panel {
          padding: 20px;
          height: 100%;
          overflow-y: auto;
        }
        .panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 20px;
          color: var(--text-primary);
        }
        .candidate-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .candidate-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .candidate-name {
          font-size: 18px;
          font-weight: 600;
        }
        .candidate-contact {
          font-size: 12px;
          color: var(--text-muted);
          display: flex;
          gap: 12px;
          margin-top: 2px;
        }
        .info-block {
          margin-bottom: 16px;
        }
        .info-label {
          font-size: 12px;
          color: var(--accent-cyan);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .info-text {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }
        .info-item {
          font-size: 13px;
          color: var(--text-secondary);
          padding: 6px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          line-height: 1.5;
        }
        .skill-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .skill-tag {
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 12px;
          background: rgba(0, 212, 255, 0.1);
          color: var(--accent-cyan);
          border: 1px solid rgba(0, 212, 255, 0.2);
        }
      `}</style>
    </div>
  );
};
