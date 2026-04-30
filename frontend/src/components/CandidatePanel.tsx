import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './CandidatePanel.module.css';
import type { CandidateInfo } from '../types';

interface Props {
  candidate: CandidateInfo | null;
  sessionId?: string | null;
}

export const CandidatePanel: React.FC<Props> = ({ candidate, sessionId }) => {
  const [showResume, setShowResume] = useState(false);

  if (!candidate) return null;

  const initials = candidate.name?.charAt(0) || '?';
  const [skillsExpanded, setSkillsExpanded] = useState(false);

  return (
    <div className={styles['candidate-panel']}>
      <div className={styles['candidate-header']}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles['header-info']}>
          <div className={styles['name-row']}>
            <div className={styles.name}>{candidate.name || 'Unknown'}</div>
            {sessionId && (
              <button className={styles['btn-resume']} onClick={() => setShowResume(true)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                查看简历
              </button>
            )}
          </div>
          <div className={styles.contacts}>
            {candidate.email && <span>{candidate.email}</span>}
            {candidate.phone && <span>{candidate.phone}</span>}
          </div>
        </div>
      </div>

      {candidate.summary && (
        <div className={styles.section}>
          <div className={styles['section-title']}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            摘要
          </div>
          <div className={styles['summary-text']}>{candidate.summary}</div>
        </div>
      )}

      {candidate.skills?.length > 0 && (
        <div className={styles.section}>
          <div className={`${styles['section-title']} ${styles['section-title-collapsible']}`} onClick={() => setSkillsExpanded(v => !v)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
            技能
            <svg className={`${styles['collapse-chevron']} ${skillsExpanded ? styles['chevron-open'] : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          <div className={`${styles['collapsible-content']} ${skillsExpanded ? styles['collapsible-open'] : ''}`}>
            <div className={styles['skill-tags']}>
              {candidate.skills.map((s, i) => (
                <span key={i} className={styles['skill-tag']}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {candidate.education?.length > 0 && (
        <div className={styles.section}>
          <div className={styles['section-title']}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
            教育背景
          </div>
          {candidate.education.map((edu, i) => (
            <div key={i} className={styles['list-item']}>
              <div className={styles['item-primary']}>{edu.school}{edu.degree ? ` - ${edu.degree}` : ''}{edu.major ? ` ${edu.major}` : ''}</div>
              {edu.period && <div className={styles['item-sub']}>{edu.period}</div>}
            </div>
          ))}
        </div>
      )}

      {candidate.risk_points?.length > 0 && (
        <div className={styles.section}>
          <div className={`${styles['section-title']} ${styles['risk-title']}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            风险点
          </div>
          {candidate.risk_points.map((r, i) => {
            const match = r.match(/^【(.+?)】(.+)$/);
            return (
              <div key={i} className={styles['risk-item']}>
                <span className={styles['risk-dot']} />
                {match ? (
                  <>
                    <span className={styles['risk-category']}>{match[1]}</span>
                    <span className={styles['risk-desc']}>{match[2]}</span>
                  </>
                ) : r}
              </div>
            );
          })}
        </div>
      )}

      {candidate.job_match && (
        <div className={styles.section}>
          <div className={`${styles['section-title']} ${styles['match-title']}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            岗位匹配 · {candidate.job_match.job_name}
          </div>
          <div className={styles['match-level-row']}>
            <span className={`${styles['match-badge']} ${styles[`match-${candidate.job_match.match_level}`]}`}>
              {candidate.job_match.match_level}
            </span>
            <span className={styles['match-summary']}>{candidate.job_match.summary}</span>
          </div>
          {candidate.job_match.points?.length > 0 && (
            <div className={styles['match-points']}>
              {candidate.job_match.points.map((p, i) => {
                const m = p.match(/^【(.+?)】(.+)$/);
                return (
                  <div key={i} className={styles['match-point']}>
                    {m ? (
                      <>
                        <span className={styles['match-point-cat']}>{m[1]}</span>
                        <span className={styles['match-point-desc']}>{m[2]}</span>
                      </>
                    ) : p}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showResume && sessionId && createPortal(
        <div className={styles['resume-overlay']} onClick={() => setShowResume(false)}>
          <div className={styles['resume-modal']} onClick={e => e.stopPropagation()}>
            <div className={styles['resume-modal-header']}>
              <span>{candidate.name || '候选人'}的简历</span>
              <button className={styles['resume-close-btn']} onClick={() => setShowResume(false)}>×</button>
            </div>
            <iframe
              src={`/api/resume/${sessionId}/pdf`}
              title="Resume PDF"
              className={styles['resume-iframe']}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};