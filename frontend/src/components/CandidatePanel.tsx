import React from 'react';
import styles from './CandidatePanel.module.css';
import type { CandidateInfo } from '../types';

interface Props {
  candidate: CandidateInfo | null;
}

export const CandidatePanel: React.FC<Props> = ({ candidate }) => {
  if (!candidate) return null;

  const initials = candidate.name?.charAt(0) || '?';

  return (
    <div className={styles['candidate-panel']}>
      <div className={styles['candidate-header']}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles['header-info']}>
          <div className={styles.name}>{candidate.name || 'Unknown'}</div>
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
          <div className={styles['section-title']}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
            技能
          </div>
          <div className={styles['skill-tags']}>
            {candidate.skills.map((s, i) => (
              <span key={i} className={styles['skill-tag']}>{s}</span>
            ))}
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
    </div>
  );
};