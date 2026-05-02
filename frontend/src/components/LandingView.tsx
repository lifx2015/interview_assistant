import React, { useState, useRef } from 'react';
import styles from './LandingView.module.css';
import type { CandidateInfo, JobRequirement } from '../types';
import { ResumeUploader } from './ResumeUploader';

interface Props {
  jobRequirements: JobRequirement[];
  selectedJobRequirementId: string;
  onJobRequirementChange: (id: string) => void;
  onUploadSuccess: (sessionId: string, candidate: CandidateInfo) => void;
  onUploadAudio: (file: File, jobRequirement?: { name: string; description: string } | null) => void;
  audioUploadStatus: string | null;
  isExiting?: boolean;
}

export const LandingView: React.FC<Props> = ({
  jobRequirements,
  selectedJobRequirementId,
  onJobRequirementChange,
  onUploadSuccess,
  onUploadAudio,
  audioUploadStatus,
  isExiting,
}) => {
  const [uploadTab, setUploadTab] = useState<'resume' | 'audio'>('resume');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedJobRequirement = jobRequirements.find(jr => jr.id === selectedJobRequirementId) || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadAudio(file, selectedJobRequirement ? { name: selectedJobRequirement.name, description: selectedJobRequirement.description } : null);
      e.target.value = '';
    }
  };

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

          {/* Resume / Audio upload card */}
          <div className={`${styles['landing-card']} ${styles['card-upload']}`}>
            <div className={styles['card-header']}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h2>上传候选人资料</h2>
            </div>
            <div className={styles['upload-tabs']}>
              <button
                className={`${styles['upload-tab']} ${uploadTab === 'resume' ? styles['upload-tab-active'] : ''}`}
                onClick={() => setUploadTab('resume')}
              >
                上传简历
              </button>
              <button
                className={`${styles['upload-tab']} ${uploadTab === 'audio' ? styles['upload-tab-active'] : ''}`}
                onClick={() => setUploadTab('audio')}
              >
                上传音频
              </button>
            </div>
            {uploadTab === 'resume' ? (
              <ResumeUploader onUploadSuccess={onUploadSuccess} variant="hero" jobRequirement={selectedJobRequirement ? { name: selectedJobRequirement.name, description: selectedJobRequirement.description } : null} />
            ) : (
              <div className={styles['audio-upload-area']}>
                <div
                  className={styles['audio-drop-zone']}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  <span className={styles['audio-drop-text']}>
                    {audioUploadStatus || '点击上传面试录音文件'}
                  </span>
                  <span className={styles['audio-drop-hint']}>
                    支持 WAV / MP3 / M4A / FLAC / OGG 格式
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wav,.mp3,.m4a,.flac,.ogg,.aac,.wma"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </div>
            )}
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
