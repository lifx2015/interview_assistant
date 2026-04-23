import React, { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import styles from './NotePanel.module.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export const NotePanel: React.FC<Props> = ({ value, onChange }) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === 'edit' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);
    setTimeout(() => {
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = start + prefix.length + (selected || 'text').length;
      ta.focus();
    }, 0);
  };

  return (
    <div className={styles['note-panel']}>
      <div className={styles['note-header']}>
        <div className={styles['note-title']}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>面试笔记</span>
        </div>
        <div className={styles['note-actions']}>
          {mode === 'edit' && (
            <div className={styles['note-toolbar']}>
              <button onClick={() => insertMarkdown('**', '**')} title="Bold">B</button>
              <button onClick={() => insertMarkdown('*', '*')} title="Italic" style={{ fontStyle: 'italic' }}>I</button>
              <button onClick={() => insertMarkdown('- ')} title="List">&#8226;</button>
              <button onClick={() => insertMarkdown('## ')} title="Heading">H</button>
            </div>
          )}
          <button
            className={`${styles['mode-btn']} ${mode === 'edit' ? styles.active : ''}`}
            onClick={() => setMode('edit')}
          >编辑</button>
          <button
            className={`${styles['mode-btn']} ${mode === 'preview' ? styles.active : ''}`}
            onClick={() => setMode('preview')}
          >预览</button>
        </div>
      </div>
      <div className={styles['note-body']}>
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            className={styles['note-editor']}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="记录面试笔记... (支持 Markdown)"
          />
        ) : (
          <div className={styles['note-preview']}>
            <MarkdownRenderer content={value} />
          </div>
        )}
      </div>
    </div>
  );
};