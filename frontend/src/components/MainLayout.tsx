import React, { useState, useRef, useCallback } from 'react';
import styles from './MainLayout.module.css';
import type { CandidateInfo, InterviewStatus, SpeakerRole, TranscriptEntry, InterviewListItem, BankQuestionGroup } from '../types';
import type { WSStatus } from '../hooks/useWebSocket';
import { ResumeUploader } from './ResumeUploader';
import { CandidatePanel } from './CandidatePanel';
import { PDFViewer } from './PDFViewer';
import { NotePanel } from './NotePanel';
import { TranscriptPanel } from './TranscriptPanel';
import { ControlBar } from './ControlBar';
import { QuestionPanel } from './QuestionPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { InterviewListPanel } from './InterviewListPanel';
import { StatusBar } from './StatusBar';
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
  bankQuestionGroups: BankQuestionGroup[];
  onAddBankGroup: (group: BankQuestionGroup) => void;
  onRemoveBankGroup: (bankId: string) => void;
  onClearBankGroups: () => void;
  wsStatus: WSStatus;
  wsError: string | null;
  audioError: string | null;
  appError: string | null;
  onClearAppError: () => void;
  onClearWsError: () => void;
  onReconnect: () => void;
}

export const MainLayout: React.FC<Props> = ({
  candidate, sessionId, status, currentRole,
  transcript, currentPartial, isAnalyzing,
  isGeneratingQuestions, questionsRaw, followUpRaw,
  evaluationRaw, isEvaluating,
  noteContent, onNoteChange,
  onUploadSuccess, onSwitchRole, onStart, onPause, onResume,
  onStop, onSubmitAnswer, onGenerateQuestions,
  onSave, isSaving, savedInterviews, onLoadInterview, onFetchList,
  bankQuestionGroups, onAddBankGroup, onRemoveBankGroup,
  wsStatus, wsError, audioError, appError,
  onClearAppError, onClearWsError, onReconnect,
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
    <div className={styles['main-layout']}>
      {/* Header */}
      <header className={styles['app-header']}>
        <div className={styles['header-left']}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          <h1 className={styles['app-title']}>AI Interview Assistant</h1>
          <span className={styles['app-subtitle']}>STAR 行为面试智能分析</span>
        </div>
        <div className={styles['header-right']}>
          {sessionId && (
            <button className={styles['btn-save']} onClick={onSave} disabled={isSaving}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {isSaving ? '保存中...' : '保存'}
            </button>
          )}
          <button className={styles['btn-list']} onClick={() => { onFetchList(); setListOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <Link to="/question-bank" className={styles['btn-question-bank']}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            题库管理
          </Link>
          <Link to="/voiceprint" className={styles['btn-voiceprint']}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            声纹管理
          </Link>
          {status === 'recording' && (
            <div className={`${styles['rec-badge']} ${styles[currentRole]}`}>
              <span className={styles['rec-dot']} />
              {currentRole === 'interviewer' ? '面试官说话中' : '候选人回答中'}
            </div>
          )}
          {status === 'paused' && <div className={`${styles['rec-badge']} ${styles.paused}`}>已暂停</div>}
          {status === 'analyzing' && (
            <div className={`${styles['rec-badge']} ${styles.analyzing}`}><span className={styles['rec-dot']} />AI 分析中</div>
          )}
        </div>
      </header>

      <StatusBar
        wsStatus={wsStatus}
        wsError={wsError}
        audioError={audioError}
        appError={appError}
        onClearAppError={onClearAppError}
        onClearWsError={onClearWsError}
        onReconnect={onReconnect}
      />

      {/* Three-column layout */}
      <div className={styles.columns} ref={containerRef}>
        {/* LEFT */}
        <aside className={`${styles['col-left']} glow-card`} style={{ width: leftWidth, minWidth: leftWidth }}>
          {candidate ? (
            <CandidatePanel candidate={candidate} />
          ) : (
            <div className={styles['left-empty']}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <p>上传简历后显示候选人信息</p>
            </div>
          )}
        </aside>

        <div className={styles['resize-handle']} onMouseDown={startDrag('left')} />

        {/* CENTER */}
        <main className={styles['col-center']} ref={centerRef}>
          <div className={styles['center-top']}>
            {sessionId ? (
              <PDFViewer sessionId={sessionId} />
            ) : (
              <ResumeUploader onUploadSuccess={onUploadSuccess} />
            )}
            {isDragging && <div className={styles['iframe-shield']} />}
          </div>

          <div className={styles['resize-handle-h']} onMouseDown={startDrag('note')} />

          <div className={`${styles['center-note']} glow-card`} style={{ height: noteHeight, minHeight: 120 }}>
            <NotePanel value={noteContent} onChange={onNoteChange} />
          </div>
        </main>

        <div className={styles['resize-handle']} onMouseDown={startDrag('right')} />

        {/* RIGHT */}
        <aside className={styles['col-right']} style={{ width: rightWidth, minWidth: rightWidth }}>
          {listOpen && <InterviewListPanel
            interviews={savedInterviews}
            onLoad={onLoadInterview}
            onClose={() => setListOpen(false)}
          />}
          <div className={`${styles['right-top']} glow-card`}>
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
          <div className={`${styles['right-bottom']} glow-card`}>
            <div className={styles['right-bottom-tabs']}>
              <button className={`${styles['right-tab']} ${rightTab === 'transcript' ? styles.active : ''}`} onClick={() => setRightTab('transcript')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                录音记录
                {transcript.length > 0 && <span className={styles['tab-count-badge']}>{transcript.length}</span>}
              </button>
              <button className={`${styles['right-tab']} ${rightTab === 'analysis' ? styles.active : ''}`} onClick={() => setRightTab('analysis')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                面试评估
                {evaluationRaw && !isEvaluating && <span className={styles['tab-dot']} />}
              </button>
            </div>
            <div className={styles['right-bottom-content']}>
              {rightTab === 'transcript' ? (
                <div className={styles['transcript-tab-content']}>
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
    </div>
  );
};