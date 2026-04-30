import React from 'react';
import styles from './NotePanel.module.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export const NotePanel: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className={styles['note-panel']}>
      <div className={styles['note-content']}>
        <textarea
          className={styles['note-textarea']}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="记录面试笔记、观察要点..."
        />
      </div>
    </div>
  );
};
