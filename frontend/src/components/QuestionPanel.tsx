import React from 'react';
import type { InterviewQuestion } from '../types';

interface Props {
  questions: InterviewQuestion[];
  isGenerating: boolean;
  questionsRaw: string;
  onGenerate: () => void;
  activeIndex: number;
  onSelectQuestion: (index: number) => void;
}

const dimensionColors: Record<string, string> = {
  '项目验证': '#6699ff',
  '风险试探': 'var(--accent-amber)',
  'STAR-情境': 'var(--accent-cyan)',
  'STAR-任务': '#6699ff',
  'STAR-行动': 'var(--accent-green)',
  'STAR-结果': 'var(--accent-amber)',
  '技术能力': 'var(--accent-cyan)',
  '团队协作': 'var(--accent-green)',
};

export const QuestionPanel: React.FC<Props> = ({
  questions,
  isGenerating,
  onGenerate,
  activeIndex,
  onSelectQuestion,
}) => {
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

      {questions.length === 0 && !isGenerating ? (
        <div className="empty-hint">点击「生成题目」基于简历自动生成面试问题</div>
      ) : isGenerating && questions.length === 0 ? (
        <div className="question-stream-area">
          <div className="question-stream-text typing-cursor">{questionsRaw}</div>
        </div>
      ) : (
        <div className="question-list">
          {questions.map((q, i) => (
            <div
              key={i}
              className={`question-card ${i === activeIndex ? 'active' : ''}`}
              onClick={() => onSelectQuestion(i)}
            >
              <div className="question-dimension" style={{ color: dimensionColors[q.dimension] || 'var(--accent-cyan)' }}>
                {q.dimension}
              </div>
              <div className="question-text">{q.question}</div>
              <div className="question-focus">考察：{q.focus}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .question-panel { display: flex; flex-direction: column; height: 100%; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .panel-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
        .generate-btn { padding: 6px 14px; font-size: 12px; }
        .empty-hint { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 12px; padding: 20px; text-align: center; }
        .question-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .question-card {
          padding: 10px 12px; border-radius: var(--radius-sm);
          background: rgba(0,0,0,0.2); border: 1px solid var(--border-color);
          cursor: pointer; transition: all 0.2s;
        }
        .question-card:hover { border-color: var(--border-glow); }
        .question-card.active { border-color: var(--accent-cyan); background: rgba(0,212,255,0.05); }
        .question-dimension { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
        .question-text { font-size: 13px; color: var(--text-primary); line-height: 1.5; margin-bottom: 3px; }
        .question-focus { font-size: 11px; color: var(--text-muted); }
      `}</style>
    </div>
  );
};
