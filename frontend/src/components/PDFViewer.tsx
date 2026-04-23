import React from 'react';
import styles from './PDFViewer.module.css';

interface Props {
  sessionId: string | null;
}

export const PDFViewer: React.FC<Props> = ({ sessionId }) => {
  if (!sessionId) {
    return (
      <div className={styles['pdf-empty']}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p>上传简历后在此预览</p>
      </div>
    );
  }

  return (
    <div className={styles['pdf-viewer']}>
      <iframe
        src={`/api/resume/${sessionId}/pdf`}
        title="Resume PDF"
        className={styles['pdf-iframe']}
      />
    </div>
  );
};