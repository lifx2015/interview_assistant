import React, { useState, useRef, useCallback } from 'react';
import type { CandidateInfo, InterviewStatus, SpeakerRole, TranscriptEntry, InterviewListItem, Question, BankQuestionGroup } from '../types';
import { ResumeUploader } from './ResumeUploader';
import { CandidatePanel } from './CandidatePanel';
import { PDFViewer } from './PDFViewer';
import { NotePanel } from './NotePanel';
import { TranscriptPanel } from './TranscriptPanel';
import { ControlBar } from './ControlBar';
import { QuestionPanel } from './QuestionPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { InterviewListPanel } from './InterviewListPanel';
import { Link } from 'react-router-dom';

interface Props {
  candidate: CandidateInfo | null;
  sessionId: string | null;
  status: InterviewStatus;
  currentRole: SpeakerRole;
  transcript: TranscriptEntry[];
  currentPartial: string;
  analysisRaw: string;
  isAnalyzing: boolean;
  isGeneratingQuestions: boolean;
  questionsRaw: string;
  followUpRaw: string;
  evaluationRaw: string;
  isEvaluating: boolean;
  noteContent: string;
  onNoteChange: (v: string) => void;
  onUploadSuccess: (sessionId: string, candidate: CandidateInfo) => void;
  onSwitchRole: (role: SpeakerRole) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSubmitAnswer: () => void;
  onGenerateQuestions: () => void;
  onSave: () => void;
  isSaving: boolean;
  savedInterviews: InterviewListItem[];
  onLoadInterview: (sessionId: string) => void;
  onFetchList: () => void;
  // 题库相关
  bankQuestionGroups: BankQuestionGroup[];
  onAddBankGroup: (group: BankQuestionGroup) => void;
  onRemoveBankGroup: (bankId: string) => void;
  onClearBankGroups: () => void;
}

export const MainLayout: React.FC<Props> = ({
  candidate, sessionId, status, currentRole,
  transcript, currentPartial, analysisRaw, isAnalyzing,
  isGeneratingQuestions, questionsRaw, followUpRaw,
  evaluationRaw, isEvaluating,
  noteContent, onNoteChange,
  onUploadSuccess, onSwitchRole, onStart, onPause, onResume,
  onStop, onSubmitAnswer, onGenerateQuestions,
  onSave, isSaving, savedInterviews, onLoadInterview, onFetchList,
  bankQuestionGroups, onAddBankGroup, onRemoveBankGroup, onClearBankGroups,
}) => {
  const [leftWidth, setLeftWidth] = useState(340);
  const [rightWidth, setRightWidth] = useState(400);
  const [noteHeight, setNoteHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [rightTab, setRightTab] = useState<'analysis' | 'transcript'>('transcript');
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'left' | 'right' | 'note' | null>(null);
  const dragOffset = useRef(0);

  const startDrag = useCallback((side: 'left' | 'right' | 'note') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = side;
    setIsDragging(true);
    document.body.style.cursor = side === 'note' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    if (side === 'note') {
      dragOffset.current = noteHeight + e.clientY;
    } else if (side === 'left') {
      dragOffset.current = e.clientX - leftWidth;
    } else if (side === 'right') {
      dragOffset.current = e.clientX + rightWidth;
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (dragging.current === 'left') {
        setLeftWidth(Math.max(240, Math.min(600, ev.clientX - dragOffset.current)));
      } else if (dragging.current === 'right') {
        setRightWidth(Math.max(280, Math.min(700, dragOffset.current - ev.clientX)));
      } else if (dragging.current === 'note' && centerRef.current) {
        const rect = centerRef.current.getBoundingClientRect();
        const newHeight = Math.max(120, Math.min(rect.height - 200, dragOffset.current - ev.clientY));
        setNoteHeight(newHeight);
      }
    };

    const onMouseUp = () => {
      dragging.current = null;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [noteHeight, leftWidth, rightWidth]);

  return (
    <div className="main-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          <h1 className="app-title">AI Interview Assistant</h1>
          <span className="app-subtitle">STAR 行为面试智能分析</span>
        </div>
        <div className="header-right">
          {sessionId && (
            <button className="btn btn-save" onClick={onSave} disabled={isSaving}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {isSaving ? '保存中...' : '保存'}
            </button>
          )}
          <button className="btn btn-list" onClick={() => { onFetchList(); setListOpen(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          <Link to="/question-bank" className="btn btn-question-bank">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            题库管理
          </Link>
          <Link to="/voiceprint" className="btn btn-voiceprint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            声纹管理
          </Link>
          {status === 'recording' && (
            <div className={`rec-badge ${currentRole}`}>
              <span className="rec-dot" />
              {currentRole === 'interviewer' ? '面试官说话中' : '候选人回答中'}
            </div>
          )}
          {status === 'paused' && <div className="rec-badge paused">已暂停</div>}
          {status === 'analyzing' && (
            <div className="rec-badge analyzing"><span className="rec-dot" />AI 分析中</div>
          )}
        </div>
      </header>

      {/* Three-column layout */}
      <div className="columns" ref={containerRef}>
        {/* LEFT */}
        <aside className="col-left glow-card" style={{ width: leftWidth, minWidth: leftWidth }}>
          {candidate ? (
            <CandidatePanel candidate={candidate} />
          ) : (
            <div className="left-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <p>上传简历后显示候选人信息</p>
            </div>
          )}
        </aside>

        <div className="resize-handle" onMouseDown={startDrag('left')} />

        {/* CENTER */}
        <main className="col-center" ref={centerRef}>
          {/* PDF / Upload */}
          <div className="center-top">
            {sessionId ? (
              <PDFViewer sessionId={sessionId} />
            ) : (
              <ResumeUploader onUploadSuccess={onUploadSuccess} />
            )}
            {isDragging && <div className="iframe-shield" />}
          </div>

          {/* Horizontal resize handle */}
          <div className="resize-handle-h" onMouseDown={startDrag('note')} />

          {/* Notes */}
          <div className="center-note glow-card" style={{ height: noteHeight, minHeight: 120 }}>
            <NotePanel value={noteContent} onChange={onNoteChange} />
          </div>
        </main>

        <div className="resize-handle" onMouseDown={startDrag('right')} />

        {/* RIGHT */}
        <aside className="col-right" style={{ width: rightWidth, minWidth: rightWidth }}>
          <InterviewListPanel
            interviews={savedInterviews}
            isOpen={listOpen}
            onClose={() => setListOpen(false)}
            onLoad={onLoadInterview}
          />
          <div className="right-top glow-card">
            <QuestionPanel
              isGenerating={isGeneratingQuestions}
              questionsRaw={questionsRaw}
              followUpRaw={followUpRaw}
              onGenerate={onGenerateQuestions}
              bankQuestionGroups={bankQuestionGroups}
              onAddBankGroup={onAddBankGroup}
              onRemoveBankGroup={onRemoveBankGroup}
            />
          </div>
          <div className="right-bottom glow-card">
            <div className="right-bottom-tabs">
              <button className={`right-tab ${rightTab === 'transcript' ? 'active' : ''}`} onClick={() => setRightTab('transcript')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                录音记录
                {transcript.length > 0 && <span className="tab-count-badge">{transcript.length}</span>}
              </button>
              <button className={`right-tab ${rightTab === 'analysis' ? 'active' : ''}`} onClick={() => setRightTab('analysis')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                面试评估
                {evaluationRaw && !isEvaluating && <span className="tab-dot" />}
              </button>
            </div>
            <div className="right-bottom-content">
              {rightTab === 'transcript' ? (
                <div className="transcript-tab-content">
                  <TranscriptPanel status={status} transcript={transcript} currentPartial={currentPartial} currentRole={currentRole} />
                  <ControlBar status={status} currentRole={currentRole} isAnalyzing={isAnalyzing}
                    onSwitchRole={onSwitchRole} onStart={onStart} onPause={onPause} onResume={onResume}
                    onStop={onStop} onSubmitAnswer={onSubmitAnswer} disabled={!sessionId} />
                </div>
              ) : (
                <AnalysisPanel analysisRaw={evaluationRaw} incrementalRaw="" isAnalyzing={isEvaluating} />
              )}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .main-layout { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

        .app-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 20px; border-bottom: 1px solid var(--border-color);
          background: rgba(0,0,0,0.3); backdrop-filter: blur(12px); flex-shrink: 0;
        }
        .header-left { display: flex; align-items: center; gap: 10px; }
        .app-title {
          font-size: 16px; font-weight: 700;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .app-subtitle { font-size: 11px; color: var(--text-muted); padding-left: 10px; border-left: 1px solid var(--border-color); }
        .header-right { display: flex; align-items: center; gap: 10px; }

        .btn-save {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border: 1px solid rgba(0,255,136,0.3); border-radius: 6px;
          background: rgba(0,255,136,0.06); color: var(--accent-green);
          font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .btn-save:hover:not(:disabled) { border-color: var(--accent-green); box-shadow: 0 0 12px rgba(0,255,136,0.15); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-voiceprint {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border: 1px solid rgba(0,212,255,0.3); border-radius: 6px;
          background: rgba(0,212,255,0.06); color: var(--accent-cyan);
          font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
          text-decoration: none;
        }
        .btn-voiceprint:hover { border-color: var(--accent-cyan); box-shadow: 0 0 12px rgba(0,212,255,0.15); }

        .btn-question-bank {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border: 1px solid rgba(139,92,246,0.3); border-radius: 6px;
          background: rgba(139,92,246,0.06); color: #a78bfa;
          font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
          text-decoration: none;
        }
        .btn-question-bank:hover { border-color: #a78bfa; box-shadow: 0 0 12px rgba(139,92,246,0.15); }

        .btn-list {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px;
          background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.15s;
        }
        .btn-list:hover { border-color: var(--border-glow); color: var(--accent-cyan); }

        .rec-badge { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 16px; font-size: 11px; font-weight: 600; }
        .rec-badge.interviewer { background: rgba(0,102,255,0.12); border: 1px solid rgba(0,102,255,0.3); color: #6699ff; }
        .rec-badge.candidate { background: rgba(255,68,102,0.1); border: 1px solid rgba(255,68,102,0.3); color: var(--accent-red); }
        .rec-badge.paused { background: rgba(255,170,0,0.1); border: 1px solid rgba(255,170,0,0.3); color: var(--accent-amber); }
        .rec-badge.analyzing { background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); color: var(--accent-cyan); }
        .rec-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulse-dot 1s ease-in-out infinite; }

        .columns { display: flex; flex: 1; overflow: hidden; }

        .col-left { background: var(--bg-secondary); overflow-y: auto; flex-shrink: 0; }
        .left-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px; }

        .resize-handle { width: 5px; cursor: col-resize; background: var(--border-color); transition: background 0.2s; flex-shrink: 0; }
        .resize-handle:hover { background: var(--accent-cyan); }

        .col-center { flex: 1; display: flex; flex-direction: column; background: var(--bg-secondary); overflow: hidden; min-width: 300px; }
        .center-top { flex: 1; overflow: hidden; min-height: 100px; position: relative; }

        .iframe-shield {
          position: absolute; inset: 0; z-index: 10; cursor: col-resize;
        }

        .resize-handle-h { height: 5px; cursor: row-resize; background: var(--border-color); transition: background 0.2s; flex-shrink: 0; }
        .resize-handle-h:hover { background: var(--accent-cyan); }

        .center-note { flex-shrink: 0; overflow: hidden; border-top: none; border-bottom: none; }

        .col-right { display: flex; flex-direction: column; flex-shrink: 0; }
        .right-top { flex: 1; background: var(--bg-secondary); overflow: hidden; }
        .right-bottom { flex: 1; background: var(--bg-secondary); overflow: hidden; display: flex; flex-direction: column; }
        .right-bottom-tabs { display: flex; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .right-tab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
          padding: 8px 12px; border: none; background: transparent;
          color: var(--text-muted); font-size: 12px; font-weight: 500; cursor: pointer;
          transition: all 0.2s; border-bottom: 2px solid transparent;
        }
        .right-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.03); }
        .right-tab.active { color: var(--accent-cyan); border-bottom-color: var(--accent-cyan); background: rgba(0,212,255,0.05); }
        .tab-count-badge {
          padding: 0 5px; min-width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center;
          background: rgba(0,212,255,0.15); border-radius: 8px; font-size: 10px; font-weight: 600; color: var(--accent-cyan);
        }
        .tab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-green); }
        .right-bottom-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .transcript-tab-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
      `}</style>
    </div>
  );
};
