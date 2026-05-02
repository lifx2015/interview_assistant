import React, { useRef } from 'react';
import styles from './ControlBar.module.css';
import type { InterviewStatus } from '../types';

interface Props {
  status: InterviewStatus;
  isAnalyzing: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled?: boolean;
  audioUploadStatus: string | null;
  onUploadAudio: (file: File, jobRequirement?: { name: string; description: string } | null) => void;
  jobRequirement?: { name: string; description: string } | null;
}

export const ControlBar: React.FC<Props> = ({
  status,
  isAnalyzing,
  disabled = false,
  onStart,
  onPause,
  onResume,
  onStop,
  audioUploadStatus,
  onUploadAudio,
  jobRequirement,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadAudio(file, jobRequirement);
      e.target.value = '';
    }
  };

  return (
    <div className={styles['control-bar']}>
      {/* Action buttons */}
      <div className={styles['action-buttons']}>
        {status === 'idle' && (
          <>
            <button className="btn btn-start" onClick={onStart} disabled={disabled}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
              {disabled ? '请先上传简历' : '开始录音'}
            </button>
            <button
              className={`btn btn-secondary ${styles['btn-upload-audio']}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={!!audioUploadStatus}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {audioUploadStatus || '上传音频文件'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.flac,.ogg,.aac,.wma"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </>
        )}
        {status === 'recording' && (
          <button className="btn btn-pause" onClick={onPause}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
            暂停
          </button>
        )}
        {status === 'paused' && (
          <button className="btn btn-start" onClick={onResume}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            继续
          </button>
        )}
        {status === 'analyzing' && (
          <div className={styles['analyzing-indicator']}>
            <div className={styles['analyzing-dots']}><span /><span /><span /></div>
            AI 分析中...
          </div>
        )}
        {status === 'evaluating' && (
          <div className={styles['analyzing-indicator']}>
            <div className={styles['analyzing-dots']}><span /><span /><span /></div>
            面试评估中...
          </div>
        )}
      </div>

      {/* Stop button */}
      <div className={styles['stop-area']}>
        {(status === 'recording' || status === 'paused' || status === 'analyzing') && (
          <button className="btn btn-stop" onClick={onStop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
            面试结束
          </button>
        )}
      </div>
    </div>
  );
};
