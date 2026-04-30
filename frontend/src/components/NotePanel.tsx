import React, { useState } from 'react';
import styles from './NotePanel.module.css';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  value: string;
  onChange: (v: string) => void;
  psychologyRaw: string;
  onTriggerPsychology?: () => void;
  isRecording?: boolean;
  isPsychologyAnalyzing?: boolean;
}

export const NotePanel: React.FC<Props> = ({ value, onChange, psychologyRaw, onTriggerPsychology, isRecording = false, isPsychologyAnalyzing = false }) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'psychology'>('notes');

  return (
    <div className={styles['note-panel']}>
      <div className={styles['note-tabs']}>
        <button
          className={`${styles['note-tab']} ${activeTab === 'notes' ? styles.active : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          面试笔记
        </button>
        <button
          className={`${styles['note-tab']} ${activeTab === 'psychology' ? styles.active : ''}`}
          onClick={() => setActiveTab('psychology')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          心理状态
          {psychologyRaw && <span className={styles['psych-dot']} />}
        </button>
      </div>

      <div className={styles['note-content']}>
        {activeTab === 'notes' ? (
          <textarea
            className={styles['note-textarea']}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="记录面试笔记、观察要点..."
          />
        ) : (
          <div className={styles['psychology-content']}>
            {/* Re-trigger button always visible */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
              <button
                onClick={onTriggerPsychology}
                disabled={!isRecording || isPsychologyAnalyzing}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  border: '1px solid var(--accent-cyan)',
                  background: 'rgba(0, 212, 255, 0.08)',
                  color: 'var(--accent-cyan)',
                  borderRadius: 6,
                  cursor: isRecording && !isPsychologyAnalyzing ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  opacity: isRecording && !isPsychologyAnalyzing ? 1 : 0.5,
                }}
              >
                {isPsychologyAnalyzing ? '⏳ 分析中...' : '🔍 分析心理状态'}
              </button>
              {!isRecording && <p style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>录音开始后可手动触发</p>}
            </div>

            {psychologyRaw ? (
              <div style={{ padding: '8px 12px' }}>
                <MarkdownRenderer content={psychologyRaw} isStreaming={true} />
              </div>
            ) : (
              <div className={styles['psychology-empty']}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
