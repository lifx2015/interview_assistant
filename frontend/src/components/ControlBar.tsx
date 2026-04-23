import React from 'react';
import styles from './ControlBar.module.css';
import type { InterviewStatus, SpeakerRole } from '../types';

interface Props {
  status: InterviewStatus;
  currentRole: SpeakerRole;
  isAnalyzing: boolean;
  disabled?: boolean;
  onSwitchRole: (role: SpeakerRole) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSubmitAnswer: () => void;
}

export const ControlBar: React.FC<Props> = ({
  status,
  currentRole,
  isAnalyzing,
  disabled = false,
  onSwitchRole,
  onStart,
  onPause,
  onResume,
  onStop,
  onSubmitAnswer,
}) => {
  return (
    <div className={styles['control-bar']}>
      {/* Role switcher */}
      <div className={styles['role-switcher']}>
        <button
          className={`${styles['role-btn']} ${currentRole === 'interviewer' ? styles.active : ''}`}
          onClick={() => onSwitchRole('interviewer')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          面试官
        </button>
        <button
          className={`${styles['role-btn']} ${styles.candidate} ${currentRole === 'candidate' ? styles.active : ''}`}
          onClick={() => onSwitchRole('candidate')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          候选人
        </button>
      </div>

      {/* Action buttons */}
      <div className={styles['action-buttons']}>
        {status === 'idle' && (
          <button className="btn btn-start" onClick={onStart} disabled={disabled}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
            {disabled ? '请先上传简历' : '开始录音'}
          </button>
        )}
        {status === 'recording' && (
          <>
            <button className="btn btn-pause" onClick={onPause}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
              暂停
            </button>
            <button className="btn btn-primary" onClick={onSubmitAnswer} disabled={isAnalyzing}>
              {isAnalyzing ? '分析中...' : '回答完毕'}
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button className="btn btn-start" onClick={onResume}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              继续
            </button>
            <button className="btn btn-primary" onClick={onSubmitAnswer} disabled={isAnalyzing}>
              {isAnalyzing ? '分析中...' : '回答完毕'}
            </button>
          </>
        )}
        {status === 'analyzing' && (
          <div className={styles['analyzing-indicator']}>
            <div className={styles['analyzing-dots']}><span /><span /><span /></div>
            AI 分析中...
          </div>
        )}
      </div>

      {/* Stop button */}
      <div className={styles['stop-area']}>
        {status !== 'idle' && (
          <button className="btn btn-stop" onClick={onStop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
            关闭
          </button>
        )}
      </div>
    </div>
  );
};