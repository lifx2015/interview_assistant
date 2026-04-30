import React from 'react';
import styles from './LandingView.module.css';
import type { CandidateInfo, JobRequirement } from '../types';
import { ResumeUploader } from './ResumeUploader';

interface Props {
  jobRequirements: JobRequirement[];
  selectedJobRequirementId: string;
  onJobRequirementChange: (id: string) => void;
  onUploadSuccess: (sessionId: string, candidate: CandidateInfo) => void;
  isExiting?: boolean;
}

export const LandingView: React.FC<Props> = ({
  jobRequirements,
  selectedJobRequirementId,
  onJobRequirementChange,
  onUploadSuccess,
  isExiting,
}) => {
  const selectedJobRequirement = jobRequirements.find(jr => jr.id === selectedJobRequirementId) || null;

  return (
    <div className={`${styles['landing-container']} ${isExiting ? styles.exiting : ''}`}>
      {/* Background effects */}
      <div className={styles['landing-bg']}>
        <div className={styles['grid-overlay']} />
        <div className={styles['scan-line']} />
      </div>

      {/* Content */}
      <div className={styles['landing-content']}>
        {/* Hero title */}
        <div className={styles['hero-title-section']}>
          <div className={styles['hero-icon']}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className={styles['hero-title']}>AI Interview Assistant</h1>
          <p className={styles['hero-subtitle']}>STAR 行为面试智能分析系统</p>
        </div>

        {/* Two cards */}
        <div className={styles['landing-cards']}>
          {/* Job requirement card */}
          <div className={`${styles['landing-card']} ${styles['card-jr']}`}>
            <div className={styles['card-header']}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <h2>选择面试岗位</h2>
            </div>
            <select
              className={styles['jr-select-hero']}
              value={selectedJobRequirementId}
              onChange={e => onJobRequirementChange(e.target.value)}
            >
              <option value="">-- 选择岗位 --</option>
              {jobRequirements.map(jr => (
                <option key={jr.id} value={jr.id}>{jr.name}</option>
              ))}
            </select>
            {selectedJobRequirement?.description && (
              <div className={styles['jr-desc-hero']}>{selectedJobRequirement.description}</div>
            )}
            {!selectedJobRequirement && (
              <div className={styles['jr-empty']}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <span>选择岗位后将显示岗位要求</span>
              </div>
            )}
          </div>

          {/* Resume upload card */}
          <div className={`${styles['landing-card']} ${styles['card-upload']}`}>
            <div className={styles['card-header']}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h2>上传候选人简历</h2>
            </div>
            <ResumeUploader onUploadSuccess={onUploadSuccess} variant="hero" jobRequirement={selectedJobRequirement ? { name: selectedJobRequirement.name, description: selectedJobRequirement.description } : null} />
          </div>
        </div>

        {/* Footer decoration */}
        <div className={styles['landing-footer']}>
          <span className={styles['footer-line']} />
          <span className={styles['footer-text']}>SYSTEM READY</span>
          <span className={styles['footer-line']} />
        </div>
      </div>
    </div>
  );
};
