import React from 'react';
import styles from './AnalysisPanel.module.css';
import type { EvaluationResult } from '../types';

interface Props {
  evaluationResult: EvaluationResult | null;
  isEvaluating: boolean;
  jobRequirementName?: string;
}

const SCORE_COLORS: Record<number, string> = {
  1: '#ff4466',
  2: '#ff6644',
  3: '#ffaa00',
  4: '#00d4ff',
  5: '#00ff88',
};

const MATCH_LEVEL_COLORS: Record<string, string> = {
  '高度匹配': '#00ff88',
  '基本匹配': '#00d4ff',
  '部分匹配': '#ffaa00',
  '不匹配': '#ff4466',
};

const SCORE_KEYS = [
  { key: 'professional', label: '专业能力', icon: '⚡' },
  { key: 'clarity', label: '表达清晰', icon: '💬' },
  { key: 'logic', label: '逻辑思维', icon: '🧠' },
  { key: 'authenticity', label: '真实性', icon: '🔍' },
  { key: 'jobFit', label: '岗位匹配', icon: '🎯' },
] as const;

const MATCH_KEYS = [
  { key: 'coreSkill', label: '核心技能', icon: '⚙' },
  { key: 'experience', label: '经验深度', icon: '📊' },
  { key: 'softSkill', label: '软素质', icon: '🤝' },
] as const;

export const AnalysisPanel: React.FC<Props> = ({
  evaluationResult, isEvaluating, jobRequirementName,
}) => {
  // Empty state
  if (!evaluationResult && !isEvaluating) {
    return (
      <div className={styles.panel}>
        <div className={styles['empty-state']}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p>面试结束后将自动生成评估报告</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isEvaluating && !evaluationResult) {
    return (
      <div className={styles.panel}>
        <div className={styles['loading-state']}>
          <div className={styles['loading-ring']} />
          <span>正在生成面试评估...</span>
        </div>
      </div>
    );
  }

  if (!evaluationResult) return null;

  const { summary, scores, jobMatch, highlights, risks, recommendation } = evaluationResult;

  return (
    <div className={styles.panel}>
      {/* Hire verdict */}
      <div className={`${styles['verdict-bar']} ${recommendation.hire ? styles.hire : styles['no-hire']}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {recommendation.hire
            ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
            : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>}
        </svg>
        {recommendation.hire ? '建议录用' : '不建议录用'}
        {jobRequirementName && <span style={{ opacity: 0.6, fontWeight: 400 }}> · {jobRequirementName}</span>}
      </div>

      {/* Summary */}
      <div className={styles['summary-banner']}>
        <div className={styles['summary-icon']}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
        </div>
        <div className={styles['summary-text']}>{summary}</div>
      </div>

      {/* Scores */}
      <div className={styles['scores-section']}>
        <div className={styles['section-label']}>维度评分</div>
        <div className={styles['scores-grid']}>
          {SCORE_KEYS.map(({ key, label, icon }) => {
            const item = scores[key];
            if (!item) return null;
            const color = SCORE_COLORS[item.score] || '#ffaa00';
            const pct = (item.score / 5) * 100;
            return (
              <div key={key} className={styles['score-row']}>
                <span className={styles['score-label']}>{icon} {label}</span>
                <div className={styles['score-bar-track']}>
                  <div
                    className={styles['score-bar-fill']}
                    style={{ width: `${pct}%`, background: color, color }}
                  />
                </div>
                <span className={styles['score-value']} style={{ color }}>{item.score}/5</span>
                <span className={styles['score-desc']}>{item.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job Match */}
      <div className={styles['match-section']}>
        <div className={styles['section-label']}>岗位匹配度</div>
        <div className={styles['match-grid']}>
          {MATCH_KEYS.map(({ key, label, icon }) => {
            const item = jobMatch[key];
            if (!item) return null;
            const color = MATCH_LEVEL_COLORS[item.level] || '#ffaa00';
            return (
              <div key={key} className={styles['match-card']}>
                <div className={styles['match-card-icon']} style={{ color, fontSize: '16px' }}>{icon}</div>
                <div className={styles['match-card-label']}>{label}</div>
                <div className={styles['match-card-level']} style={{ color }}>{item.level}</div>
                <div className={styles['match-card-desc']}>{item.desc}</div>
              </div>
            );
          })}
        </div>
        {jobMatch.summary && (
          <div className={styles['match-overall']}>
            <strong>综合匹配：{jobMatch.overall}</strong> — {jobMatch.summary}
          </div>
        )}
      </div>

      {/* Highlights & Risks */}
      <div className={styles['details-section']}>
        <details className={styles['detail-block']} open>
          <summary className={styles['detail-summary']}>亮点</summary>
          <div className={styles['detail-content']}>
            <ul className={styles['tag-list']}>
              {highlights.map((h, i) => (
                <li key={i} className={`${styles['tag-item']} ${styles.highlight}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </details>

        <details className={styles['detail-block']} open>
          <summary className={styles['detail-summary']}>不足与风险</summary>
          <div className={styles['detail-content']}>
            <ul className={styles['tag-list']}>
              {risks.map((r, i) => (
                <li key={i} className={`${styles['tag-item']} ${styles.risk}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </details>

        <details className={styles['detail-block']}>
          <summary className={styles['detail-summary']}>面试建议</summary>
          <div className={styles['detail-content']}>
            <div className={styles['recommendation-block']}>
              <div className={styles['rec-reason']}>{recommendation.reason}</div>
              {recommendation.nextFocus && (
                <div className={styles['rec-next']}>
                  <strong>下一轮重点：</strong>{recommendation.nextFocus}
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};