import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  isGenerating: boolean;
  questionsRaw: string;
  followUpRaw: string;
  onGenerate: () => void;
}

export const QuestionPanel: React.FC<Props> = ({
  isGenerating,
  questionsRaw,
  followUpRaw,
  onGenerate,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'followup'>('preset');
  const hasFollowUp = followUpRaw.length > 0;
  const hasQuestions = questionsRaw.length > 0;

  // Auto-switch to followup tab when followUp content arrives
  React.useEffect(() => {
    if (hasFollowUp) {
      setActiveTab('followup');
    }
  }, [hasFollowUp]);

  return (
    <div className="question-panel">
      <div className="panel-header">
        <h3 className="panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          面试题目
        </h3>
        <button
          className="btn btn-primary generate-btn"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? '生成中...' : '生成题目'}
        </button>
      </div>

      {/* Tabs */}
      {(hasQuestions || hasFollowUp) && (
        <div className="panel-tabs">
          <button
            className={`tab ${activeTab === 'preset' ? 'active' : ''}`}
            onClick={() => setActiveTab('preset')}
          >
            预设问题
          </button>
          <button
            className={`tab ${activeTab === 'followup' ? 'active' : ''} ${hasFollowUp ? 'has-new' : ''}`}
            onClick={() => setActiveTab('followup')}
          >
            实时追问
            {hasFollowUp && <span className="new-badge">●</span>}
          </button>
        </div>
      )}

      <div className="question-body">
        {activeTab === 'preset' && (
          <>
            {questionsRaw ? (
              <MarkdownRenderer content={questionsRaw} isStreaming={isGenerating} />
            ) : (
              <div className="empty-hint">点击「生成题目」基于简历自动生成面试问题</div>
            )}
          </>
        )}

        {activeTab === 'followup' && (
          <>
            {followUpRaw ? (
              <div className="followup-content">
                <div className="followup-header">
                  <span className="live-indicator">
                    <span className="live-dot" />
                    基于候选人回答实时生成
                  </span>
                </div>
                <MarkdownRenderer content={followUpRaw} isStreaming={true} />
              </div>
            ) : (
              <div className="empty-hint">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <p>候选人回答时将实时生成追问建议</p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .question-panel { display: flex; flex-direction: column; height: 100%; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .panel-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
        .generate-btn { padding: 6px 14px; font-size: 12px; }

        .panel-tabs {
          display: flex;
          gap: 2px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          background: rgba(0,0,0,0.2);
          flex-shrink: 0;
        }
        .tab {
          flex: 1;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
        .tab.active {
          background: rgba(0,212,255,0.1);
          color: var(--accent-cyan);
          font-weight: 600;
        }
        .tab.has-new { color: var(--accent-green); }
        .new-badge {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-green);
          animation: pulse-dot 1s ease-in-out infinite;
        }

        .question-body { flex: 1; overflow-y: auto; padding: 12px 14px; }
        .empty-hint { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted); font-size: 12px; text-align: center; }

        .followup-content { height: 100%; }
        .followup-header {
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px dashed var(--border-color);
        }
        .live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--accent-cyan);
          background: rgba(0,212,255,0.08);
          padding: 4px 10px;
          border-radius: 12px;
          border: 1px solid rgba(0,212,255,0.15);
        }
        .live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-cyan);
          animation: pulse-dot 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
