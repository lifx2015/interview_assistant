import React, { useEffect } from 'react';
import type { WSStatus } from '../hooks/useWebSocket';
import styles from './StatusBar.module.css';

interface Props {
  wsStatus: WSStatus;
  wsError: string | null;
  audioError: string | null;
  appError: string | null;
  onClearAppError: () => void;
  onClearWsError: () => void;
  onReconnect: () => void;
}

export const StatusBar: React.FC<Props> = ({
  wsStatus,
  wsError,
  audioError,
  appError,
  onClearAppError,
  onClearWsError,
  onReconnect,
}) => {
  const activeError = appError || wsError || audioError;

  useEffect(() => {
    if (!activeError) return;
    const timer = setTimeout(() => {
      if (appError) onClearAppError();
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeError, appError, onClearAppError]);

  if (wsStatus === 'connected' && !activeError) return null;

  if (wsStatus === 'connecting') {
    return (
      <div className={`${styles['status-bar']} ${styles.connecting}`}>
        <span className={styles['status-dot']} />
        正在连接服务器...
      </div>
    );
  }

  if (wsStatus === 'error' || wsStatus === 'disconnected') {
    const showReconnect = wsStatus === 'error' || wsStatus === 'disconnected';
    return (
      <div className={`${styles['status-bar']} ${styles.disconnected}`}>
        <span className={styles['status-dot']} />
        {wsError || '与服务器的连接已断开'}
        {showReconnect && (
          <button className={styles['reconnect-btn']} onClick={onReconnect}>
            重新连接
          </button>
        )}
        <button className={styles['dismiss-btn']} onClick={onClearWsError}>
          ✕
        </button>
      </div>
    );
  }

  if (activeError) {
    return (
      <div className={`${styles['status-bar']} ${styles.error}`}>
        <span className={styles['status-dot']} />
        {activeError}
        <button className={styles['dismiss-btn']} onClick={onClearAppError}>
          ✕
        </button>
      </div>
    );
  }

  return null;
};
