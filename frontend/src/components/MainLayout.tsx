import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './MainLayout.module.css';
import type { CandidateInfo, InterviewStatus, SpeakerRole, TranscriptEntry, InterviewListItem, BankQuestionGroup, JobRequirement, InterviewMode, EvaluationResult } from '../types';
import type { WSStatus } from '../hooks/useWebSocket';
import { CandidatePanel } from './CandidatePanel';
import { NotePanel } from './NotePanel';
import { TranscriptPanel } from './TranscriptPanel';
import { ControlBar } from './ControlBar';
import { QuestionPanel } from './QuestionPanel';
import { AnalysisPanel } from './AnalysisPanel';
import { InterviewListPanel } from './InterviewListPanel';
import { StatusBar } from './StatusBar';
import { LandingView } from './LandingView';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PsychologyDashboard } from './PsychologyDashboard';
import { Link } from 'react-router-dom';

interface Props {
  candidate: CandidateInfo | null;
  sessionId: string | null;
  status: InterviewStatus;
  currentRole: SpeakerRole;
  transcript: TranscriptEntry[];
  pendingSentences: { text: string; sentence_id: number }[];
  currentPartial: string;
  isAnalyzing: boolean;
  isGeneratingQuestions: boolean;
  questionsRaw: string;
  followUpRaw: string;
  lastFollowUpRaw: string;
  evaluationResult: EvaluationResult | null;
  isEvaluating: boolean;
  psychologyRaw: string;
  isPsychologyAnalyzing: boolean;
  noteContent: string;
  onNoteChange: (v: string) => void;
  onUploadSuccess: (sessionId: string, candidate: CandidateInfo) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onGenerateQuestions: () => void;
  onSave: () => void;
  isSaving: boolean;
  recordingPaths: string[];
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
  onSetJobRequirement: (jr: { name: string; description: string } | null) => void;
  onTriggerFollowUp: () => void;
  onTriggerPsychology: () => void;
  voiceprintEnabled: boolean;
  mode: InterviewMode;
  onModeChange: (mode: InterviewMode) => void;
  systemAudioError: string | null;
  partialByRole: Record<SpeakerRole, string>;
  audioUploadStatus: string | null;
  onUploadAudio: (file: File, jobRequirement?: { name: string; description: string } | null) => void;
}

type BottomTab = 'transcript' | 'evaluation' | 'notes' | 'psychology';

export const MainLayout: React.FC<Props> = ({
  candidate, sessionId, status, currentRole,
  transcript, pendingSentences, currentPartial, isAnalyzing,
  isGeneratingQuestions, questionsRaw, followUpRaw, lastFollowUpRaw,
  evaluationResult, isEvaluating, psychologyRaw, isPsychologyAnalyzing,
  noteContent, onNoteChange,
  onUploadSuccess, onStart, onPause, onResume,
  onStop, onGenerateQuestions,
  onSave, isSaving, recordingPaths, savedInterviews, onLoadInterview, onFetchList,
  bankQuestionGroups, onAddBankGroup, onRemoveBankGroup,
  wsStatus, wsError, audioError, appError,
  onClearAppError, onClearWsError, onReconnect, onSetJobRequirement,
  onTriggerFollowUp, onTriggerPsychology,
  voiceprintEnabled, mode, onModeChange, systemAudioError, partialByRole,
  audioUploadStatus, onUploadAudio,
}) => {
  const [leftWidth, setLeftWidth] = useState(340);
  const [bottomHeight, setBottomHeight] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>('transcript');
  const [jobRequirements, setJobRequirements] = useState<JobRequirement[]>([]);
  const [selectedJobRequirementId, setSelectedJobRequirementId] = useState<string>('');
  const [viewPhase, setViewPhase] = useState<'landing' | 'transitioning' | 'workspace'>(sessionId ? 'workspace' : 'landing');
  const containerRef = useRef<HTMLDivElement>(null);
  const prevJobRequirementIdRef = useRef<string>('');
  const dragging = useRef<'left' | 'bottom' | null>(null);
  const dragOffset = useRef(0);

  const startDrag = useCallback((side: 'left' | 'bottom') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = side;
    setIsDragging(true);
    document.body.style.cursor = side === 'left' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    dragOffset.current = side === 'left' ? e.clientX - leftWidth : e.clientY + bottomHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (dragging.current === 'left') {
        setLeftWidth(Math.max(240, Math.min(600, ev.clientX - dragOffset.current)));
      } else if (dragging.current === 'bottom') {
        setBottomHeight(Math.max(150, Math.min(600, dragOffset.current - ev.clientY)));
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
  }, [leftWidth, bottomHeight]);

  useEffect(() => {
    fetch('/api/job-requirement/list')
      .then(res => res.json())
      .then(data => setJobRequirements(data.requirements || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedJobRequirementId && selectedJobRequirementId !== prevJobRequirementIdRef.current) {
      const jr = jobRequirements.find(j => j.id === selectedJobRequirementId);
      if (jr) {
        onSetJobRequirement({ name: jr.name, description: jr.description });
      }
    } else if (!selectedJobRequirementId && prevJobRequirementIdRef.current) {
      onSetJobRequirement(null);
    }
    prevJobRequirementIdRef.current = selectedJobRequirementId;
  }, [selectedJobRequirementId, jobRequirements, onSetJobRequirement]);

  const selectedJobRequirement = jobRequirements.find(jr => jr.id === selectedJobRequirementId) || null;

  const handleLandingUpload = useCallback((sid: string, info: CandidateInfo) => {
    onUploadSuccess(sid, info);
    setViewPhase('transitioning');
    setTimeout(() => setViewPhase('workspace'), 800);
  }, [onUploadSuccess]);

  const handleLandingLoadInterview = useCallback((sessionId: string) => {
    onLoadInterview(sessionId);
    setViewPhase('transitioning');
    setTimeout(() => setViewPhase('workspace'), 800);
  }, [onLoadInterview]);

  useEffect(() => {
    if (sessionId && viewPhase === 'landing') {
      setViewPhase('workspace');
    }
  }, [sessionId, viewPhase]);

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
          {recordingPaths?.length > 0 && sessionId && (
            <a
              href={`/api/interview/${sessionId}/recording`}
              download
              className={styles['btn-download']}
              title="下载录音"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              录音
            </a>
          )}
          <button className={styles['btn-list']} onClick={() => { onFetchList(); setListOpen(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <Link to="/job-requirement" className={styles['btn-job-requirement']}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
            岗位管理
          </Link>
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
          <div className={styles['mode-toggle']}>
            <button
              className={`${styles['mode-btn']} ${mode === 'dual-track' ? styles['mode-btn-active'] : ''}`}
              onClick={() => onModeChange('dual-track')}
              disabled={status !== 'idle'}
            >
              双轨面试
            </button>
            <button
              className={`${styles['mode-btn']} ${mode === 'single-track' ? styles['mode-btn-active'] : ''}`}
              onClick={() => onModeChange('single-track')}
              disabled={status !== 'idle'}
            >
              单轨面试
            </button>
          </div>
          {status === 'recording' && mode === 'dual-track' && (
            <div className={`${styles['rec-badge']} ${styles['dual-track']}`}>
              <span className={styles['rec-dot']} />
              双轨录音中
            </div>
          )}
          {status === 'recording' && mode === 'single-track' && voiceprintEnabled && (
            <div className={`${styles['rec-badge']} ${styles[currentRole]}`}>
              <span className={styles['rec-dot']} />
              {currentRole === 'interviewer' ? '面试官说话中' : '候选人回答中'}
            </div>
          )}
          {status === 'recording' && mode === 'single-track' && !voiceprintEnabled && (
            <div className={`${styles['rec-badge']} ${styles.warning}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              请先注册面试官声纹
            </div>
          )}
          {status === 'paused' && <div className={`${styles['rec-badge']} ${styles.paused}`}>已暂停</div>}
          {status === 'analyzing' && (
            <div className={`${styles['rec-badge']} ${styles.analyzing}`}><span className={styles['rec-dot']} />AI 分析中</div>
          )}
          {status === 'evaluating' && (
            <div className={`${styles['rec-badge']} ${styles.analyzing}`}><span className={styles['rec-dot']} />面试评估中</div>
          )}
        </div>
      </header>

      <StatusBar
        wsStatus={wsStatus}
        wsError={wsError}
        audioError={audioError}
        appError={appError}
        systemAudioError={systemAudioError}
        onClearAppError={onClearAppError}
        onClearWsError={onClearWsError}
        onReconnect={onReconnect}
      />

      {/* Interview list overlay (available in both landing and workspace) */}
      {listOpen && <InterviewListPanel
        interviews={savedInterviews}
        onLoad={viewPhase === 'landing' || viewPhase === 'transitioning' ? handleLandingLoadInterview : onLoadInterview}
        onClose={() => setListOpen(false)}
      />}

      {/* Landing view (before upload) */}
      {(viewPhase === 'landing' || viewPhase === 'transitioning') && (
        <LandingView
          jobRequirements={jobRequirements}
          selectedJobRequirementId={selectedJobRequirementId}
          onJobRequirementChange={setSelectedJobRequirementId}
          onUploadSuccess={handleLandingUpload}
          onUploadAudio={onUploadAudio}
          audioUploadStatus={audioUploadStatus}
          isExiting={viewPhase === 'transitioning'}
        />
      )}

      {/* Two-column layout (after upload) */}
      {(viewPhase === 'transitioning' || viewPhase === 'workspace') && (
        <div className={`${styles.columns} ${viewPhase === 'transitioning' ? styles['workspace-entering'] : ''} ${isDragging ? styles.dragging : ''}`} ref={containerRef}>
        {/* LEFT - Candidate info */}
        <aside className={`${styles['col-left']} glow-card`} style={{ width: leftWidth, minWidth: leftWidth }}>
          {candidate ? (
            <CandidatePanel candidate={candidate} sessionId={sessionId} />
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

        {/* RIGHT - Questions (top) & Bottom tabs (transcript/evaluation/notes/psychology) */}
        <main className={styles['col-center']}>
          <div className={`${styles['center-top']} glow-card`}>
            <QuestionPanel
              isGenerating={isGeneratingQuestions}
              questionsRaw={questionsRaw}
              followUpRaw={followUpRaw}
              lastFollowUpRaw={lastFollowUpRaw}
              onGenerate={onGenerateQuestions}
              bankQuestionGroups={bankQuestionGroups}
              onAddBankGroup={onAddBankGroup}
              onRemoveBankGroup={onRemoveBankGroup}
              onTriggerFollowUp={onTriggerFollowUp}
              isRecording={status === 'recording' || status === 'paused'}
              isAnalyzing={isAnalyzing}
            />
          </div>
          <div className={styles['resize-handle-v']} onMouseDown={startDrag('bottom')} />
          <div className={`${styles['center-bottom']} glow-card`} style={{ height: bottomHeight }}>
            <div className={styles['center-bottom-tabs']}>
              <button className={`${styles['right-tab']} ${bottomTab === 'transcript' ? styles.active : ''}`} onClick={() => setBottomTab('transcript')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                录音记录
                {transcript.length > 0 && <span className={styles['tab-count-badge']}>{transcript.length}</span>}
              </button>
              <button className={`${styles['right-tab']} ${bottomTab === 'evaluation' ? styles.active : ''}`} onClick={() => setBottomTab('evaluation')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                面试评估
                {evaluationResult && !isEvaluating && <span className={styles['tab-dot']} />}
              </button>
              <button className={`${styles['right-tab']} ${bottomTab === 'notes' ? styles.active : ''}`} onClick={() => setBottomTab('notes')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                面试笔记
              </button>
              <button className={`${styles['right-tab']} ${bottomTab === 'psychology' ? styles.active : ''}`} onClick={() => setBottomTab('psychology')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                心理状态
                {psychologyRaw && <span className={styles['tab-dot']} style={{ background: 'var(--accent-amber)' }} />}
              </button>
            </div>
            <div className={styles['center-bottom-content']}>
              {bottomTab === 'transcript' && (
                <div className={styles['transcript-tab-content']}>
                  <TranscriptPanel status={status} transcript={transcript} pendingSentences={pendingSentences} currentPartial={currentPartial} currentRole={currentRole} mode={mode} partialByRole={partialByRole} />
                  <ControlBar status={status} isAnalyzing={isAnalyzing}
                    onStart={onStart} onPause={onPause} onResume={onResume}
                    onStop={onStop} disabled={!sessionId}
                    audioUploadStatus={audioUploadStatus}
                    onUploadAudio={onUploadAudio}
                    jobRequirement={selectedJobRequirement ? { name: selectedJobRequirement.name, description: selectedJobRequirement.description } : null} />
                </div>
              )}
              {bottomTab === 'evaluation' && (
                <AnalysisPanel evaluationResult={evaluationResult} isEvaluating={isEvaluating} jobRequirementName={selectedJobRequirement?.name} />
              )}
              {bottomTab === 'notes' && (
                <NotePanel value={noteContent} onChange={onNoteChange} />
              )}
              {bottomTab === 'psychology' && (
                <PsychologyDashboard
                  psychologyRaw={psychologyRaw}
                  isPsychologyAnalyzing={isPsychologyAnalyzing}
                  isRecordingOrPaused={status === 'recording' || status === 'paused'}
                  onTriggerPsychology={onTriggerPsychology}
                />
              )}
            </div>
          </div>
        </main>
        </div>
      )}
    </div>
  );
};
