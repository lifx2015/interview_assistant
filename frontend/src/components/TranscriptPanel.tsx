import React, { useRef, useEffect } from 'react';
import styles from './TranscriptPanel.module.css';
import type { InterviewStatus, SpeakerRole, TranscriptEntry } from '../types';

interface Props {
  status: InterviewStatus;
  transcript: TranscriptEntry[];
  pendingSentences: { text: string; sentence_id: number }[];
  currentPartial: string;
  currentRole: SpeakerRole;
}

export const TranscriptPanel: React.FC<Props> = ({
  status,
  transcript,
  pendingSentences,
  currentPartial,
  currentRole,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, pendingSentences, currentPartial]);

  return (
    <div className={styles['transcript-area']}>
      {/* Always show status hint at top when empty or recording */}
      {transcript.length === 0 && pendingSentences.length === 0 && !currentPartial && (
        <div className={styles['transcript-empty']}>
          {status === 'recording'
            ? `聆听${currentRole === 'interviewer' ? '面试官' : '候选人'}中...`
            : status === 'paused' ? '已暂停' : '等待开始录音'}
        </div>
      )}

      {/* Show partial text prominently when recording */}
      {status === 'recording' && currentPartial && (
        <div className={styles['partial-hint']}>
          正在转写: <span className={styles['partial-text']}>{currentPartial}</span>
        </div>
      )}

      {/* Transcript entries */}
      {transcript.map((entry) => (
        <div key={entry.id} className={`${styles.bubble} ${styles[entry.role]} animate-fade-in-up`}>
          <span className={styles['bubble-label']}>{entry.role === 'interviewer' ? '面试官' : '候选人'}</span>
          <span className={styles['bubble-text']}>{entry.text}</span>
        </div>
      ))}

      {/* Pending sentences - waiting for voiceprint confirmation */}
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

      <div ref={bottomRef} />
    </div>
  );
};