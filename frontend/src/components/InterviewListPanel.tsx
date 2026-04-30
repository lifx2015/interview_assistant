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
            <div key={item.session_id} className={styles['list-item']}>
              <div className={styles['list-item-info']} onClick={() => onLoad(item.session_id)}>
                <span className={styles['list-item-name']}>{item.candidate_name}</span>
                <span className={styles['list-item-date']}>{item.created_at?.slice(0, 10)}</span>
              </div>
              {item.recording_paths && item.recording_paths.length > 0 && (
                <div className={styles['list-item-downloads']}>
                  {item.recording_paths.map((_, idx) => (
                    <a
                      key={idx}
                      href={`/api/interview/${item.session_id}/recording/${idx}`}
                      download
                      className={styles['download-btn']}
                      title={item.recording_paths!.length > 1
                        ? (idx === 0 ? '下载面试官录音' : '下载面试者录音')
                        : '下载录音'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {item.recording_paths!.length > 1 && (
                        <span>{idx === 0 ? '官' : '者'}</span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
