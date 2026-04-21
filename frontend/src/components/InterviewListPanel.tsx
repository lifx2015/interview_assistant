import React, { useEffect, useRef } from 'react';
import type { InterviewListItem } from '../types';

interface Props {
  interviews: InterviewListItem[];
  isOpen: boolean;
  onClose: () => void;
  onLoad: (sessionId: string) => void;
}

export const InterviewListPanel: React.FC<Props> = ({ interviews, isOpen, onClose, onLoad }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr + (isoStr.includes('Z') || isoStr.includes('+') ? '' : 'Z'));
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div ref={panelRef} className="interview-list-panel">
      <div className="list-panel-header">
        <span>面试记录</span>
        <button className="list-panel-close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="list-panel-body">
        {interviews.length === 0 ? (
          <div className="list-empty">暂无保存的面试记录</div>
        ) : (
          interviews.map((item) => (
            <div key={item.session_id} className="list-item" onClick={() => { onLoad(item.session_id); onClose(); }}>
              <div className="list-item-name">{item.candidate_name}</div>
              <div className="list-item-date">{formatDate(item.created_at)}</div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .interview-list-panel {
          position: fixed;
          top: 52px;
          right: 0;
          width: 300px;
          max-height: calc(100vh - 72px);
          background: rgba(10, 14, 23, 0.97);
          border: 1px solid var(--border-glow);
          border-top: 2px solid var(--accent-cyan);
          border-radius: 0 0 0 12px;
          backdrop-filter: blur(20px);
          box-shadow: -8px 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(0, 212, 255, 0.1);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slide-in-right 0.2s ease-out;
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .list-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .list-panel-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .list-panel-close:hover { color: var(--text-primary); }
        .list-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .list-empty {
          padding: 32px 16px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        .list-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.15s;
          border-left: 3px solid transparent;
        }
        .list-item:hover {
          background: rgba(0, 212, 255, 0.06);
          border-left-color: var(--accent-cyan);
        }
        .list-item-name {
          font-size: 14px;
          color: var(--text-primary);
          font-weight: 500;
        }
        .list-item-date {
          font-size: 11px;
          color: var(--text-muted);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};
