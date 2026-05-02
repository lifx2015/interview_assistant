import React, { useMemo, useId } from 'react';
import styles from './PsychologyDashboard.module.css';
import { MarkdownRenderer } from './MarkdownRenderer';

type Level = '低' | '中' | '高';

interface MetricData {
  level: Level | null;
  reason: string;
}

interface ParsedPsychology {
  metrics: {
    tension: MetricData;
    confidence: MetricData;
    defensiveness: MetricData;
    scriptRisk: MetricData;
  };
  sections: { title: string; content: string }[];
}

function parsePsychologyRaw(raw: string): ParsedPsychology {
  const result: ParsedPsychology = {
    metrics: {
      tension: { level: null, reason: '' },
      confidence: { level: null, reason: '' },
      defensiveness: { level: null, reason: '' },
      scriptRisk: { level: null, reason: '' },
    },
    sections: [],
  };

  if (!raw) return result;

  // Extract metric levels
  const tensionMatch = raw.match(/\*\*紧张程度\*\*[：:]\s*(低|中|高)\s*[—\-–]?\s*(.*)/);
  if (tensionMatch) {
    result.metrics.tension = { level: tensionMatch[1] as Level, reason: tensionMatch[2].trim() };
  }

  const confidenceMatch = raw.match(/\*\*自信心\*\*[：:]\s*(低|中|高)\s*[—\-–]?\s*(.*)/);
  if (confidenceMatch) {
    result.metrics.confidence = { level: confidenceMatch[1] as Level, reason: confidenceMatch[2].trim() };
  }

  const defensivenessMatch = raw.match(/\*\*防御性\*\*[：:]\s*(低|中|高)\s*[—\-–]?\s*(.*)/);
  if (defensivenessMatch) {
    result.metrics.defensiveness = { level: defensivenessMatch[1] as Level, reason: defensivenessMatch[2].trim() };
  }

  const scriptRiskMatch = raw.match(/\*\*风险等级\*\*[：:]\s*(低|中|高)/);
  if (scriptRiskMatch) {
    result.metrics.scriptRisk = { level: scriptRiskMatch[1] as Level, reason: '' };
  }

  // Split into sections by ## headings
  const sectionParts = raw.split(/^## /m);
  for (let i = 1; i < sectionParts.length; i++) {
    const part = sectionParts[i];
    const lineBreakIdx = part.indexOf('\n');
    const title = lineBreakIdx >= 0 ? part.slice(0, lineBreakIdx).trim() : part.trim();
    const content = lineBreakIdx >= 0 ? part.slice(lineBreakIdx + 1).trim() : '';
    if (title) {
      result.sections.push({ title, content });
    }
  }

  // Fallback: if no sections parsed, use entire raw content
  if (result.sections.length === 0 && raw.trim()) {
    result.sections.push({ title: '心理状态分析', content: raw });
  }

  return result;
}

const METRIC_CONFIG = [
  {
    key: 'tension' as const,
    label: '紧张程度',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    colors: { 低: '#00d4ff', 中: '#ffaa00', 高: '#ff4466' },
  },
  {
    key: 'confidence' as const,
    label: '自信心',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    colors: { 低: '#ff4466', 中: '#ffaa00', 高: '#00ff88' },
  },
  {
    key: 'defensiveness' as const,
    label: '防御性',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    colors: { 低: '#00ff88', 中: '#ffaa00', 高: '#ff4466' },
  },
  {
    key: 'scriptRisk' as const,
    label: '念稿风险',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
    colors: { 低: '#00ff88', 中: '#ffaa00', 高: '#ff4466' },
  },
];

const LEVEL_PERCENT = { 低: 0.33, 中: 0.66, 高: 1.0 };
const CIRCUMFERENCE = 2 * Math.PI * 46; // ~289
const ARC_RATIO = 0.75; // 270 degrees
const VISIBLE_ARC = CIRCUMFERENCE * ARC_RATIO; // ~216.75
const GAP_OFFSET = CIRCUMFERENCE * (1 - ARC_RATIO); // ~72.25

function getArcOffset(level: Level | null): number {
  if (!level) return VISIBLE_ARC + GAP_OFFSET;
  const fill = VISIBLE_ARC * LEVEL_PERCENT[level];
  return CIRCUMFERENCE - fill;
}

interface GaugeCardProps {
  label: string;
  level: Level | null;
  color: string;
  icon: React.ReactNode;
  filterId: string;
  isStreaming: boolean;
}

const GaugeCard: React.FC<GaugeCardProps> = ({ label, level, color, icon, filterId, isStreaming }) => {
  const offset = getArcOffset(level);

  return (
    <div className={styles['gauge-card']}>
      <div className={styles['gauge-svg-wrap']}>
        <svg viewBox="0 0 120 120" width="100%" height="100%">
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <g transform="rotate(135 60 60)">
            {/* Background track */}
            <circle
              cx="60" cy="60" r="46" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="6"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={GAP_OFFSET}
              strokeLinecap="round"
            />
            {/* Foreground arc */}
            <circle
              cx="60" cy="60" r="46" fill="none"
              stroke={color} strokeWidth="6"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap="round"
              filter={`url(#${filterId})`}
              className={isStreaming ? styles['gauge-arc-glow'] : styles['gauge-arc']}
            />
          </g>
          {/* Level text */}
          <text
            x="60" y="55"
            textAnchor="middle"
            dominantBaseline="central"
            className={styles['gauge-level-text']}
            style={{ fill: color }}
          >
            {level || '...'}
          </text>
          {/* Icon below level */}
          <g transform="translate(60, 72)" style={{ color }}>
            <foreignObject x="-7" y="-7" width="14" height="14">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color, opacity: 0.7 }}>
                {icon}
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>
      <div className={styles['gauge-label']}>{label}</div>
    </div>
  );
};

interface PsychologyDashboardProps {
  psychologyRaw: string;
  isPsychologyAnalyzing: boolean;
  isRecordingOrPaused: boolean;
  onTriggerPsychology: () => void;
}

export const PsychologyDashboard: React.FC<PsychologyDashboardProps> = ({
  psychologyRaw,
  isPsychologyAnalyzing,
  isRecordingOrPaused,
  onTriggerPsychology,
}) => {
  const parsed = useMemo(() => parsePsychologyRaw(psychologyRaw), [psychologyRaw]);
  const baseId = useId();

  return (
    <div className={styles.dashboard}>
      {/* Trigger button - only during recording */}
      {isRecordingOrPaused && (
        <div className={styles['trigger-bar']}>
          <button
            onClick={onTriggerPsychology}
            disabled={isPsychologyAnalyzing}
            className={styles['trigger-btn']}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            {isPsychologyAnalyzing ? '分析中...' : '分析心理状态'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!psychologyRaw && (
        <div className={styles['empty-state']}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <p>上传音频或录音结束后自动生成心理状态分析</p>
        </div>
      )}

      {/* Gauges + Details */}
      {psychologyRaw && (
        <>
          {/* Gauges row */}
          <div className={styles['gauges-row']}>
            {METRIC_CONFIG.map((cfg) => {
              const metric = parsed.metrics[cfg.key];
              const color = cfg.colors[metric.level ?? '低'];
              return (
                <GaugeCard
                  key={cfg.key}
                  label={cfg.label}
                  level={metric.level}
                  color={color}
                  icon={cfg.icon}
                  filterId={`${baseId}-${cfg.key}`}
                  isStreaming={isPsychologyAnalyzing}
                />
              );
            })}
          </div>

          {/* Streaming indicator */}
          {isPsychologyAnalyzing && (
            <div className={styles['streaming-indicator']}>
              <span className={styles['streaming-dot']} />
              分析中...
            </div>
          )}

          {/* Detail sections */}
          <div className={styles['details-section']}>
            {parsed.sections.map((section, i) => (
              <details key={i} className={styles['detail-block']} open={i < 2}>
                <summary className={styles['detail-summary']}>
                  {section.title}
                </summary>
                <div className={styles['detail-content']}>
                  <MarkdownRenderer content={section.content} isStreaming={isPsychologyAnalyzing} />
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
