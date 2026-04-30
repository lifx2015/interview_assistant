import React, { useRef, useEffect } from 'react';
import styles from './TranscriptPanel.module.css';
import type { InterviewStatus, SpeakerRole, TranscriptEntry, InterviewMode } from '../types';

interface Props {
  status: InterviewStatus;
  transcript: TranscriptEntry[];
  pendingSentences: { text: string; sentence_id: number }[];
  currentPartial: string;
  currentRole: SpeakerRole;
  mode?: InterviewMode;
  partialByRole?: Record<SpeakerRole, string>;
}

export const TranscriptPanel: React.FC<Props> = ({
  status,
  transcript,
  pendingSentences,
  currentPartial,
  currentRole,
  mode,
  partialByRole,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript history when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const hasActivePartial = status === 'recording' && (
    (mode === 'dual-track' && partialByRole && (partialByRole.interviewer || partialByRole.candidate))
    || (mode !== 'dual-track' && currentPartial)
  );

  return (
    <div className={styles['transcript-container']}>
      {/* Fixed top area: always visible, shows current partial/pending */}
      {hasActivePartial && (
        <div className={styles['active-area']}>
          {mode === 'dual-track' && partialByRole && (
            <>
              {partialByRole.interviewer && (
                <div className={`${styles['partial-hint']} ${styles.interviewer}`}>
                  <span className={styles['partial-label']}>面试官 正在转写</span>
                  <span className={styles['partial-dots']}><span /><span /><span /></span>
                  <span className={styles['partial-text']}>{partialByRole.interviewer}</span>
                </div>
              )}
              {partialByRole.candidate && (
                <div className={`${styles['partial-hint']} ${styles.candidate}`}>
                  <span className={styles['partial-label']}>候选人 正在转写</span>
                  <span className={styles['partial-dots']}><span /><span /><span /></span>
                  <span className={styles['partial-text']}>{partialByRole.candidate}</span>
                </div>
              )}
            </>
          )}
          {mode !== 'dual-track' && currentPartial && (
            <div className={styles['partial-hint']}>
              <span className={styles['partial-label']}>正在转写</span>
              <span className={styles['partial-dots']}><span /><span /><span /></span>
              <span className={styles['partial-text']}>{currentPartial}</span>
            </div>
          )}
          {pendingSentences.length > 0 && (
            <div className={styles['pending-area']}>
              {pendingSentences.map((sent) => (
                <div key={sent.sentence_id} className={styles['pending-item']}>
                  <span className={styles['pending-icon']}>🔄</span>
                  <span className={styles['pending-text']}>正在识别角色: {sent.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scrollable transcript history */}
      <div className={styles['transcript-history']}>
        {transcript.length === 0 && !hasActivePartial && (
          <div className={styles['transcript-empty']}>
            {status === 'recording'
              ? `聆听${currentRole === 'interviewer' ? '面试官' : '候选人'}中...`
              : status === 'paused' ? '已暂停' : '等待开始录音'}
          </div>
        )}

        {transcript.map((entry) => (
          <div key={entry.id} className={`${styles.bubble} ${styles[entry.role]} animate-fade-in-up`}>
            <span className={styles['bubble-label']}>{entry.role === 'interviewer' ? '面试官' : '候选人'}</span>
            <span className={styles['bubble-text']}>{entry.text}</span>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};