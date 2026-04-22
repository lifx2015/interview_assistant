import React, { useState, useRef, useCallback } from 'react';
import type { CandidateInfo, InterviewStatus, SpeakerRole, TranscriptEntry, InterviewListItem } from '../types';
import { ResumeUploader } from './ResumeUploader';
import { CandidatePanel } from './CandidatePanel';
import { PDFViewer } from './PDFViewer';
import { NotePanel } from './NotePanel';
import { TranscriptPanel } from './TranscriptPanel';
import { ControlBar } from './ControlBar';
import { QuestionPanel } from './QuestionPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { InterviewListPanel } from './InterviewListPanel';

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
  incrementalRaw: string;
  followUpRaw: string;
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
}

export const MainLayout: React.FC<Props> = ({
  candidate, sessionId, status, currentRole,
  transcript, currentPartial, analysisRaw, isAnalyzing,
  isGeneratingQuestions, questionsRaw, incrementalRaw, followUpRaw,
  noteContent, onNoteChange,
  onUploadSuccess, onSwitchRole, onStart, onPause, onResume,
  onStop, onSubmitAnswer, onGenerateQuestions,
  onSave, isSaving, savedInterviews, onLoadInterview, onFetchList,
}) => {
  const [leftWidth, setLeftWidth] = useState(340);
  const [rightWidth, setRightWidth] = useState(400);
  const [noteHeight, setNoteHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const liveTranscriptRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'left' | 'right' | 'note' | null>(null);

  const startDrag = useCallback((side: 'left' | 'right' | 'note') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = side;
    setIsDragging(true);
    document.body.style.cursor = side === 'note' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (dragging.current === 'left' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setLeftWidth(Math.max(240, Math.min(600, ev.clientX - rect.left)));
      } else if (dragging.current === 'right' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setRightWidth(Math.max(280, Math.min(700, rect.right - ev.clientX)));
      } else if (dragging.current === 'note' && centerRef.current) {
        const rect = centerRef.current.getBoundingClientRect();
        const fromBottom = rect.bottom - ev.clientY;
        setNoteHeight(Math.max(120, Math.min(rect.height - 200, fromBottom)));
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
  }, []);

  // Auto-scroll live transcript
  React.useEffect(() => {
    if (liveTranscriptRef.current) {
      liveTranscriptRef.current.scrollTop = liveTranscriptRef.current.scrollHeight;
    }
  }, [transcript, currentPartial]);

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
          {/* PDF / Upload / Live Transcript */}
          <div className="center-top">
            {status === 'recording' || status === 'paused' || status === 'analyzing' ? (
              <div className="live-transcript-area">
                <div className="live-transcript-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  <span>实时对话</span>
                  {status === 'recording' && <span className="live-dot" />}
                </div>
                <div className="live-transcript-body" ref={liveTranscriptRef}>
                  {transcript.map((entry) => (
                    <div key={entry.id} className={`live-msg ${entry.role}`}>
                      <span className="live-msg-role">{entry.role === 'interviewer' ? '面试官' : '候选人'}</span>
                      <span className="live-msg-text">{entry.text}</span>
                    </div>
                  ))}
                  {currentPartial && (
                    <div className={`live-msg ${currentRole} partial`}>
                      <span className="live-msg-role">{currentRole === 'interviewer' ? '面试官' : '候选人'}</span>
                      <span className="live-msg-text">{currentPartial}<span className="typing-cursor" /></span>
                    </div>
                  )}
                </div>
              </div>
            ) : sessionId ? (
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

          {/* Transcript + Controls */}
          <div className="center-bottom glow-card">
            <TranscriptPanel status={status} transcript={transcript} currentPartial={currentPartial} currentRole={currentRole} />
            <ControlBar status={status} currentRole={currentRole} isAnalyzing={isAnalyzing}
              onSwitchRole={onSwitchRole} onStart={onStart} onPause={onPause} onResume={onResume}
              onStop={onStop} onSubmitAnswer={onSubmitAnswer} />
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
            <QuestionPanel isGenerating={isGeneratingQuestions}
              questionsRaw={questionsRaw}
              followUpRaw={followUpRaw}
              onGenerate={onGenerateQuestions} />
          </div>
          <div className="right-bottom glow-card">
            <AnalysisPanel analysisRaw={analysisRaw}
              incrementalRaw={incrementalRaw}
              isAnalyzing={isAnalyzing} />
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

        .live-transcript-area { display: flex; flex-direction: column; height: 100%; background: var(--bg-secondary); }
        .live-transcript-header {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-bottom: 1px solid var(--border-color);
          font-size: 13px; font-weight: 600; color: var(--text-primary); flex-shrink: 0;
        }
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: var(--accent-red);
          animation: pulse-dot 1s ease-in-out infinite; margin-left: auto;
        }
        .live-transcript-body {
          flex: 1; overflow-y: auto; padding: 12px 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .live-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; }
        .live-msg.interviewer {
          align-self: flex-start; background: rgba(0,102,255,0.08);
          border: 1px solid rgba(0,102,255,0.15); border-bottom-left-radius: 4px;
        }
        .live-msg.candidate {
          align-self: flex-end; background: rgba(0,255,136,0.05);
          border: 1px solid rgba(0,255,136,0.12); border-bottom-right-radius: 4px;
        }
        .live-msg.partial { opacity: 0.7; }
        .live-msg-role {
          display: block; font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px;
        }
        .live-msg.interviewer .live-msg-role { color: #6699ff; }
        .live-msg.candidate .live-msg-role { color: var(--accent-green); }
        .live-msg-text { font-size: 14px; line-height: 1.6; color: var(--text-primary); }

        .iframe-shield {
          position: absolute; inset: 0; z-index: 10; cursor: col-resize;
        }

        .resize-handle-h { height: 5px; cursor: row-resize; background: var(--border-color); transition: background 0.2s; flex-shrink: 0; }
        .resize-handle-h:hover { background: var(--accent-cyan); }

        .center-note { flex-shrink: 0; overflow: hidden; border-top: none; border-bottom: none; }

        .center-bottom { height: 180px; min-height: 140px; display: flex; flex-direction: column; border-top: 1px solid var(--border-color); flex-shrink: 0; }

        .col-right { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
        .right-top { flex: 1; background: var(--bg-secondary); overflow: hidden; }
        .right-bottom { flex: 1; background: var(--bg-secondary); overflow: hidden; }
      `}</style>
    </div>
  );
};
