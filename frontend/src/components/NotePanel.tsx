import React, { useState, useRef, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export const NotePanel: React.FC<Props> = ({ value, onChange }) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTemplate = useCallback((before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const newText = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newText);
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
      ta.focus();
    }, 0);
  }, [value, onChange]);

  // Simple markdown to HTML
  const renderMarkdown = (md: string): string => {
    let html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/\n/g, '<br/>');
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*?<\/li><br\/?>)+)/g, (match) =>
      '<ul>' + match.replace(/<br\/?>/g, '') + '</ul>'
    );
    return html;
  };

  return (
    <div className="note-panel">
      <div className="note-header">
        <div className="note-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          面试笔记
        </div>
        <div className="note-actions">
          <div className="note-toolbar">
            <button title="标题" onClick={() => insertTemplate('## ', '')}>H</button>
            <button title="加粗" onClick={() => insertTemplate('**', '**')}>B</button>
            <button title="斜体" onClick={() => insertTemplate('*', '*')}>I</button>
            <button title="列表" onClick={() => insertTemplate('- ', '')}>&#8226;</button>
            <button title="代码" onClick={() => insertTemplate('`', '`')}>{'{}'}</button>
          </div>
          <button className={`mode-btn ${!isPreview ? 'active' : ''}`} onClick={() => setIsPreview(false)}>编辑</button>
          <button className={`mode-btn ${isPreview ? 'active' : ''}`} onClick={() => setIsPreview(true)}>预览</button>
        </div>
      </div>

      <div className="note-body">
        {isPreview ? (
          <div className="note-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
        ) : (
          <textarea
            ref={textareaRef}
            className="note-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="记录面试想法、思路、观察...&#10;&#10;支持 Markdown 格式：&#10;## 标题&#10;**加粗** *斜体*&#10;- 列表项&#10;`代码`"
            spellCheck={false}
          />
        )}
      </div>

      <style>{`
        .note-panel { display: flex; flex-direction: column; height: 100%; }

        .note-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 12px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;
        }
        .note-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text-primary); }
        .note-actions { display: flex; align-items: center; gap: 6px; }

        .note-toolbar { display: flex; gap: 2px; padding-right: 8px; border-right: 1px solid var(--border-color); margin-right: 2px; }
        .note-toolbar button {
          width: 24px; height: 24px; border: none; border-radius: 4px;
          background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .note-toolbar button:hover { background: rgba(0,212,255,0.1); color: var(--accent-cyan); }

        .mode-btn {
          padding: 3px 8px; border: 1px solid var(--border-color); border-radius: 4px;
          background: transparent; color: var(--text-muted); font-size: 11px;
          cursor: pointer; transition: all 0.15s;
        }
        .mode-btn:hover { border-color: var(--border-glow); }
        .mode-btn.active { background: rgba(0,212,255,0.1); border-color: var(--accent-cyan); color: var(--accent-cyan); }

        .note-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

        .note-editor {
          flex: 1; width: 100%; padding: 10px 12px; border: none; outline: none;
          background: transparent; color: var(--text-primary); font-size: 13px;
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
          line-height: 1.6; resize: none; tab-size: 2;
        }
        .note-editor::placeholder { color: var(--text-muted); }

        .note-preview {
          flex: 1; overflow-y: auto; padding: 10px 12px;
          font-size: 13px; line-height: 1.6; color: var(--text-secondary);
        }
        .note-preview h1 { font-size: 16px; color: var(--text-primary); margin: 8px 0 4px; font-weight: 700; }
        .note-preview h2 { font-size: 14px; color: var(--text-primary); margin: 6px 0 3px; font-weight: 600; }
        .note-preview h3 { font-size: 13px; color: var(--text-primary); margin: 4px 0 2px; font-weight: 600; }
        .note-preview strong { color: var(--text-primary); }
        .note-preview em { color: var(--accent-cyan); }
        .note-preview code {
          padding: 1px 5px; border-radius: 3px; font-size: 12px;
          background: rgba(0,212,255,0.08); color: var(--accent-cyan);
          font-family: 'JetBrains Mono', monospace;
        }
        .note-preview ul { padding-left: 18px; margin: 4px 0; }
        .note-preview li { margin: 2px 0; }
      `}</style>
    </div>
  );
};
