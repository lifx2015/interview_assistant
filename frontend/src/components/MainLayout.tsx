import React from 'react';
import type { CandidateInfo, InterviewStatus } from '../types';
import { ResumeUploader } from './ResumeUploader';
import { ResumePanel } from './ResumePanel';
import { TranscriptPanel } from './TranscriptPanel';
import { ControlBar } from './ControlBar';
import { AnalysisPanel } from './AnalysisPanel';
import { RecordingIndicator } from './RecordingIndicator';

interface Props {
  candidate: CandidateInfo | null;
  sessionId: string | null;
  status: InterviewStatus;
  transcript: Array<{ id: number; text: string; isFinal: boolean; timestamp: number }>;
  currentPartial: string;
  currentQuestion: string;
  analysis: any;
  analysisRaw: string;
  isAnalyzing: boolean;
  onUploadSuccess: (sessionId: string, candidate: CandidateInfo) => void;
  onQuestionChange: (q: string) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSubmitAnswer: () => void;
}

export const MainLayout: React.FC<Props> = ({
  candidate,
  sessionId,
  status,
  transcript,
  currentPartial,
  currentQuestion,
  analysis,
  analysisRaw,
  isAnalyzing,
  onUploadSuccess,
  onQuestionChange,
  onStart,
  onPause,
  onResume,
  onStop,
  onSubmitAnswer,
}) => {
  return (
    <div className="main-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="app-title">AI Interview Assistant</h1>
          <span className="app-subtitle">STAR 行为面试智能分析</span>
        </div>
        <div className="header-right">
          {status === 'recording' && <RecordingIndicator />}
          {sessionId && (
            <span className="session-badge">Session: {sessionId.slice(0, 8)}...</span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Left Panel - Resume */}
        <aside className="panel-left glow-card">
          {candidate ? (
            <ResumePanel candidate={candidate} />
          ) : (
            <ResumeUploader onUploadSuccess={onUploadSuccess} />
          )}
        </aside>

        {/* Center Panel - Transcript */}
        <main className="panel-center glow-card">
          <TranscriptPanel
            status={status}
            transcript={transcript}
            currentPartial={currentPartial}
            currentQuestion={currentQuestion}
            onQuestionChange={onQuestionChange}
          />
          <ControlBar
            status={status}
            isAnalyzing={isAnalyzing}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onStop={onStop}
            onSubmitAnswer={onSubmitAnswer}
          />
        </main>

        {/* Right Panel - Analysis */}
        <aside className="panel-right glow-card">
          {analysis || analysisRaw ? (
            <AnalysisPanel
              starFollowups={analysis?.star_followups || []}
              riskAssessments={analysis?.risk_assessments || []}
              overallComment={analysis?.overall_comment || ''}
              rawText={analysisRaw}
            />
          ) : (
            <div className="analysis-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p>上传简历并开始录音后</p>
              <p>AI 将在此生成 STAR 追问与风险评估</p>
            </div>
          )}
        </aside>
      </div>

      <style>{`
        .main-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          border-bottom: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(12px);
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo {
          display: flex;
          align-items: center;
        }

        .app-title {
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .app-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          padding-left: 12px;
          border-left: 1px solid var(--border-color);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .session-badge {
          font-size: 11px;
          color: var(--text-muted);
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(0, 212, 255, 0.08);
          border: 1px solid rgba(0, 212, 255, 0.15);
          font-family: monospace;
        }

        .main-content {
          display: flex;
          flex: 1;
          gap: 1px;
          overflow: hidden;
          background: var(--border-color);
        }

        .panel-left {
          width: 280px;
          min-width: 280px;
          overflow-y: auto;
          background: var(--bg-secondary);
        }

        .panel-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          overflow: hidden;
        }

        .panel-right {
          width: 340px;
          min-width: 340px;
          overflow-y: auto;
          background: var(--bg-secondary);
        }

        .analysis-empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
          padding: 40px;
        }
      `}</style>
    </div>
  );
};
