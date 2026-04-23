import React from 'react';
import styles from './InterviewListPanel.module.css';
import type { InterviewListItem } from '../types';

interface Props {
  interviews: InterviewListItem[];
  onLoad: (sessionId: string) => void;
  onClose: () => void;
}

export const InterviewListPanel: React.FC<Props> = ({ interviews, onLoad, onClose }) => {
  return (
    <div className={styles['interview-list-panel']}>
      <div className={styles['list-panel-header']}>
        <span>已保存面试</span>
        <button className={styles['list-panel-close']} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className={styles['list-panel-body']}>
        {interviews.length === 0 ? (
          <div className={styles['list-empty']}>暂无保存的面试记录</div>
        ) : (
          interviews.map((item) => (
            <div key={item.session_id} className={styles['list-item']} onClick={() => onLoad(item.session_id)}>
              <span className={styles['list-item-name']}>{item.candidate_name}</span>
              <span className={styles['list-item-date']}>{item.created_at?.slice(0, 10)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};