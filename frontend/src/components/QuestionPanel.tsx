import React, { useState, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { Question, BankQuestionGroup } from '../types';

interface QuestionBank {
  id: string;
  name: string;
  questions: Question[];
}

interface Props {
  isGenerating: boolean;
  questionsRaw: string;
  followUpRaw: string;
  onGenerate: () => void;
  bankQuestionGroups?: BankQuestionGroup[];
  onAddBankGroup?: (group: BankQuestionGroup) => void;
  onRemoveBankGroup?: (bankId: string) => void;
}

export const QuestionPanel: React.FC<Props> = ({
  isGenerating,
  questionsRaw,
  followUpRaw,
  onGenerate,
  bankQuestionGroups = [],
  onAddBankGroup,
  onRemoveBankGroup,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'followup' | string>('preset');
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Record<string, Set<string>>>({});

  const hasFollowUp = followUpRaw.length > 0;
  const hasQuestions = questionsRaw.length > 0;

  useEffect(() => {
    if (bankQuestionGroups.length > 0) {
      const lastGroup = bankQuestionGroups[bankQuestionGroups.length - 1];
      setActiveTab(`bank_${lastGroup.bankId}`);
    }
  }, [bankQuestionGroups.length]);

  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      const res = await fetch('/api/question-bank/list');
      if (res.ok) {
        const data = await res.json();
        const banksWithQuestions: QuestionBank[] = [];
        for (const bank of data.banks || []) {
          const detailRes = await fetch(`/api/question-bank/${bank.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            banksWithQuestions.push({
              id: detail.id,
              name: detail.name,
              questions: detail.questions || [],
            });
          }
        }
        setBanks(banksWithQuestions);
      }
    } catch (e) {
      console.error('Failed to fetch banks:', e);
    }
    setLoadingBanks(false);
  };

  const openBankSelector = () => {
    setShowBankSelector(true);
    fetchBanks();
    setSelectedQuestionIds({});
  };

  const toggleQuestionSelection = (bankId: string, questionId: string) => {
    setSelectedQuestionIds(prev => {
      const newSelected = { ...prev };
      if (!newSelected[bankId]) {
        newSelected[bankId] = new Set();
      }
      const bankSelected = new Set(newSelected[bankId]);
      if (bankSelected.has(questionId)) {
        bankSelected.delete(questionId);
      } else {
        bankSelected.add(questionId);
      }
      newSelected[bankId] = bankSelected;
      return newSelected;
    });
  };

  const toggleSelectAll = (bank: QuestionBank) => {
    setSelectedQuestionIds(prev => {
      const newSelected = { ...prev };
      const currentSelected = newSelected[bank.id];
      if (currentSelected && currentSelected.size === bank.questions.length) {
        newSelected[bank.id] = new Set();
      } else {
        newSelected[bank.id] = new Set(bank.questions.map(q => q.id));
      }
      return newSelected;
    });
  };

  const confirmAddQuestions = async (bank: QuestionBank) => {
    const selectedIds = selectedQuestionIds[bank.id];
    if (!selectedIds || selectedIds.size === 0) return;


    const selectedQuestions = bank.questions.filter(q => selectedIds.has(q.id));
    if (selectedQuestions.length === 0) return;

    if (onAddBankGroup) {
      onAddBankGroup({
        bankId: bank.id,
        bankName: bank.name,
        questions: selectedQuestions,
      });
    }

    setSelectedQuestionIds(prev => ({ ...prev, [bank.id]: new Set() }));
    setShowBankSelector(false);

    const remaining = bank.questions.filter(q => !selectedIds.has(q.id));
    if (remaining.length === 0) {
      setExpandedBankId(null);
    }
  };

  const removeBankGroup = (bankId: string) => {
    if (onRemoveBankGroup) {
      onRemoveBankGroup(bankId);
      if (activeTab === `bank_${bankId}`) {
        setActiveTab('preset');
      }
    }
  };

  const getDifficultyStyle = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return { bg: 'rgba(0,255,136,0.15)', color: '#00ff88', label: '简单' };
      case 'hard': return { bg: 'rgba(255,68,102,0.15)', color: '#ff4466', label: '困难' };
      default: return { bg: 'rgba(255,170,0,0.15)', color: '#ffaa00', label: '中等' };
    }
  };

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
        <div className="header-actions">
          <button className="btn btn-secondary add-bank-btn" onClick={openBankSelector} title="从题库添加题目">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
            </svg>
            添加题库
          </button>
          <button className="btn btn-primary generate-btn" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? '生成中...' : '生成题目'}
          </button>
        </div>
      </div>

      <div className="panel-tabs">
        <button className={`tab ${activeTab === 'preset' ? 'active' : ''}`} onClick={() => setActiveTab('preset')}>
          预设问题
          {hasQuestions && <span className="dot-indicator" />}
        </button>
        <button className={`tab ${activeTab === 'followup' ? 'active' : ''} ${hasFollowUp ? 'has-new' : ''}`} onClick={() => setActiveTab('followup')}>
          实时追问
          {hasFollowUp && <span className="new-badge">NEW</span>}
        </button>
        {bankQuestionGroups.map(group => (
          <button
            key={group.bankId}
            className={`tab bank-tab ${activeTab === `bank_${group.bankId}` ? 'active' : ''}`}
            onClick={() => setActiveTab(`bank_${group.bankId}`)}
          >
            <span className="tab-name">{group.bankName}</span>
            <span className="tab-count">{group.questions.length}</span>
            <span className="tab-close" onClick={e => { e.stopPropagation(); removeBankGroup(group.bankId); }}>
              ×
            </span>
          </button>
        ))}
      </div>

      <div className="question-body">
        {activeTab === 'preset' && (
          <>
            {questionsRaw ? (
              <MarkdownRenderer content={questionsRaw} isStreaming={isGenerating} />
            ) : (
              <div className="empty-hint">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p>点击「生成题目」基于简历自动生成面试问题</p>
              </div>
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
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <p>候选人回答时将实时生成追问建议</p>
              </div>
            )}
          </>
        )}

        {bankQuestionGroups.map(group =>
          activeTab === `bank_${group.bankId}` ? (
            <div key={group.bankId} className="bank-group-content">
              <div className="bank-group-header">
                <div className="bank-info">
                  <span className="bank-icon">📚</span>
                  <span className="bank-name">{group.bankName}</span>
                  <span className="bank-count">{group.questions.length} 道题</span>
                </div>
                <button className="btn-remove-group" onClick={() => removeBankGroup(group.bankId)}>移除题库</button>
              </div>
              <div className="bank-questions-list">
                {group.questions.map((q, idx) => {
                  const diff = getDifficultyStyle(q.difficulty);
                  return (
                    <div key={q.id} className="bank-question-card">
                      <div className="question-header">
                        <span className="question-number">{idx + 1}</span>
                        {q.category && <span className="category-tag">{q.category}</span>}
                        <span className="difficulty-tag" style={{ background: diff.bg, color: diff.color }}>
                          {diff.label}
                        </span>
                      </div>
                      <p className="question-content">{q.content}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null
        )}
      </div>

      {showBankSelector && (
        <div className="bank-selector-modal" onClick={() => setShowBankSelector(false)}>
          <div className="bank-selector-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>选择题库</h3>
                <p className="modal-subtitle">展开题库并选择要添加的题目</p>
              </div>
              <button className="close-btn" onClick={() => setShowBankSelector(false)}>×</button>
            </div>

            {loadingBanks ? (
              <div className="loading">
                <div className="spinner" />
                <span>加载中...</span>
              </div>
            ) : banks.length === 0 ? (
              <div className="empty-banks">
                <span className="empty-icon">📚</span>
                <p>暂无题库</p>
                <a href="/question-bank" target="_blank" className="link">去创建题库 →</a>
              </div>
            ) : (
              <div className="banks-list">
                {banks.map(bank => {
                  const isExpanded = expandedBankId === bank.id;
                  const selectedCount = selectedQuestionIds[bank.id]?.size || 0;
                  const hasSelected = selectedCount > 0;
                  return (
                    <div key={bank.id} className={`bank-item ${isExpanded ? 'expanded' : ''} ${hasSelected ? 'has-selected' : ''}`}>
                      <div className="bank-summary" onClick={() => setExpandedBankId(isExpanded ? null : bank.id)}>
                        <div className="bank-info-row">
                          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                          <div className="bank-title">
                            <span className="bank-name-text">{bank.name}</span>
                            <span className="bank-meta">{bank.questions.length} 道题</span>
                          </div>
                          {hasSelected && <span className="selected-badge">已选 {selectedCount} 题</span>}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="bank-questions-detail">
                          {bank.questions.length === 0 ? (
                            <p className="no-questions">题库为空</p>
                          ) : (
                            <>
                              <div className="selection-bar">
                                <button className="btn-select-all" onClick={() => toggleSelectAll(bank)}>
                                  {selectedCount === bank.questions.length ? '取消全选' : '全选'}
                                </button>
                                <span className="selection-count">已选择 {selectedCount} / {bank.questions.length} 题</span>
                              </div>
                              <div className="questions-scroll">
                                {bank.questions.map(q => {
                                  const isSelected = selectedQuestionIds[bank.id]?.has(q.id);
                                  const diff = getDifficultyStyle(q.difficulty);
                                  return (
                                    <div
                                      key={q.id}
                                      className={`question-select-item ${isSelected ? 'selected' : ''}`}
                                      onClick={() => toggleQuestionSelection(bank.id, q.id)}
                                    >
                                      <div className="select-checkbox">
                                        <div className={`checkbox ${isSelected ? 'checked' : ''}`}>{isSelected && '✓'}</div>
                                      </div>
                                      <div className="question-info">
                                        <div className="question-tags">
                                          {q.category && <span className="tag">{q.category}</span>}
                                          <span className="tag" style={{ background: diff.bg, color: diff.color }}>{diff.label}</span>
                                        </div>
                                        <p className="question-text-select">{q.content}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="add-action-bar">
                                <button
                                  className="btn btn-primary"
                                  onClick={() => confirmAddQuestions(bank)}
                                  disabled={selectedCount === 0}
                                >
                                  添加选中的 {selectedCount} 道题
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .question-panel { display: flex; flex-direction: column; height: 100%; position: relative; }
        .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .panel-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; margin: 0; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s; border: 1px solid; display: inline-flex; align-items: center; gap: 5px; }
        .btn-primary { background: rgba(0,212,255,0.1); border-color: rgba(0,212,255,0.3); color: var(--accent-cyan); }
        .btn-primary:hover:not(:disabled) { background: rgba(0,212,255,0.2); border-color: var(--accent-cyan); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: rgba(255,255,255,0.05); border-color: var(--border-color); color: var(--text-secondary); }
        .btn-secondary:hover { border-color: var(--accent-green); color: var(--accent-green); }
        .add-bank-btn { padding: 6px 12px; }
        .panel-tabs { display: flex; gap: 2px; padding: 8px 12px; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.2); flex-shrink: 0; overflow-x: auto; scrollbar-width: thin; }
        .panel-tabs::-webkit-scrollbar { height: 4px; }
        .panel-tabs::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 2px; }
        .tab { flex-shrink: 0; padding: 6px 14px; border: none; border-radius: 6px; background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; position: relative; }
        .tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
        .tab.active { background: rgba(0,212,255,0.1); color: var(--accent-cyan); font-weight: 600; }
        .tab.has-new { color: var(--accent-green); }
        .dot-indicator { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-cyan); }
        .new-badge { padding: 1px 5px; background: var(--accent-green); color: #000; border-radius: 4px; font-size: 9px; font-weight: 700; }
        .bank-tab { background: rgba(139,92,246,0.08); border: 1px solid transparent; }
        .bank-tab:hover { border-color: rgba(139,92,246,0.3); }
        .bank-tab.active { background: rgba(139,92,246,0.15); border-color: rgba(139,92,246,0.5); color: #a78bfa; }
        .tab-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tab-count { padding: 1px 6px; background: rgba(139,92,246,0.2); border-radius: 10px; font-size: 10px; font-weight: 600; }
        .tab-close { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 14px; line-height: 1; opacity: 0.5; transition: all 0.2s; }
        .tab-close:hover { opacity: 1; background: rgba(255,68,102,0.2); color: var(--accent-red); }
        .question-body { flex: 1; overflow-y: auto; padding: 12px 14px; }
        .empty-hint { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--text-muted); font-size: 13px; text-align: center; padding: 40px 20px; }
        .empty-hint p { margin: 0; }
        .followup-content { height: 100%; }
        .followup-header { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--border-color); }
        .live-indicator { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--accent-cyan); background: rgba(0,212,255,0.08); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(0,212,255,0.15); }
        .live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent-cyan); animation: pulse-dot 1s ease-in-out infinite; }
        .bank-group-content { display: flex; flex-direction: column; height: 100%; }
        .bank-group-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(139,92,246,0.05); border: 1px solid rgba(139,92,246,0.2); border-radius: 8px; margin-bottom: 12px; }
        .bank-info { display: flex; align-items: center; gap: 8px; }
        .bank-icon { font-size: 18px; }
        .bank-name { font-weight: 600; color: var(--text-primary); }
        .bank-count { padding: 2px 8px; background: rgba(139,92,246,0.15); border-radius: 10px; font-size: 11px; color: #a78bfa; }
        .btn-remove-group { padding: 4px 12px; border: 1px solid rgba(255,68,102,0.3); background: rgba(255,68,102,0.1); color: var(--accent-red); border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .btn-remove-group:hover { background: rgba(255,68,102,0.2); border-color: var(--accent-red); }
        .bank-questions-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
        .bank-question-card { padding: 14px 16px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 8px; transition: all 0.2s; }
        .bank-question-card:hover { border-color: rgba(139,92,246,0.3); background: rgba(139,92,246,0.03); }
        .question-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .question-number { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background: rgba(139,92,246,0.2); border-radius: 50%; font-size: 11px; font-weight: 600; color: #a78bfa; }
        .category-tag { padding: 2px 8px; background: rgba(102,153,255,0.15); border-radius: 4px; font-size: 10px; color: #6699ff; }
        .difficulty-tag { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
        .question-content { font-size: 13px; line-height: 1.6; color: var(--text-primary); margin: 0; }
        .bank-selector-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .bank-selector-content { width: 100%; max-width: 600px; max-height: 85vh; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
        .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .modal-header h3 { margin: 0 0 4px 0; font-size: 16px; }
        .modal-subtitle { font-size: 12px; color: var(--text-muted); }
        .close-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--text-muted); font-size: 18px; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
        .close-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }
        .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: var(--text-muted); }
        .spinner { width: 32px; height: 32px; border: 2px solid var(--border-color); border-top-color: var(--accent-cyan); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty-banks { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: var(--text-muted); text-align: center; }
        .empty-icon { font-size: 48px; opacity: 0.5; }
        .empty-banks p { margin: 0; font-size: 14px; }
        .link { display: inline-block; margin-top: 8px; padding: 8px 16px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 6px; color: var(--accent-cyan); text-decoration: none; font-size: 13px; transition: all 0.2s; }
        .link:hover { background: rgba(0,212,255,0.2); }
        .banks-list { overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .bank-item { border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; transition: all 0.2s; flex-shrink: 0; }
        .bank-item:hover { border-color: var(--border-glow); }
        .bank-item.expanded { border-color: var(--accent-cyan); box-shadow: 0 0 0 1px rgba(0,212,255,0.2); }
        .bank-item.has-selected { border-color: rgba(139,92,246,0.5); background: rgba(139,92,246,0.05); }
        .bank-summary { padding: 12px 16px; cursor: pointer; background: rgba(0,0,0,0.2); transition: background 0.2s; }
        .bank-summary:hover { background: rgba(0,0,0,0.3); }
        .bank-info-row { display: flex; align-items: center; gap: 12px; }
        .expand-icon { font-size: 12px; color: var(--text-muted); transition: transform 0.2s; }
        .bank-title { flex: 1; display: flex; align-items: center; gap: 12px; }
        .bank-name-text { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .bank-meta { font-size: 12px; color: var(--text-muted); }
        .selected-badge { padding: 3px 10px; background: rgba(139,92,246,0.2); border-radius: 12px; font-size: 11px; color: #a78bfa; font-weight: 500; }
        .bank-questions-detail { padding: 12px 16px; background: rgba(0,0,0,0.15); border-top: 1px solid var(--border-color); max-height: 320px; display: flex; flex-direction: column; }
        .no-questions { text-align: center; color: var(--text-muted); font-size: 13px; margin: 0; padding: 20px; }
        .selection-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed var(--border-color); flex-shrink: 0; }
        .btn-select-all { padding: 4px 12px; border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary); border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .btn-select-all:hover { border-color: var(--accent-cyan); color: var(--accent-cyan); }
        .selection-count { font-size: 12px; color: var(--text-muted); }
        .questions-scroll { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .question-select-item { display: flex; gap: 12px; padding: 10px 12px; background: rgba(0,0,0,0.2); border: 1px solid transparent; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
        .question-select-item:hover { border-color: var(--border-glow); background: rgba(0,0,0,0.25); }
        .question-select-item.selected { border-color: var(--accent-cyan); background: rgba(0,212,255,0.05); }
        .select-checkbox { flex-shrink: 0; }
        .checkbox { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 2px solid var(--border-color); border-radius: 4px; font-size: 11px; color: #fff; transition: all 0.2s; }
        .checkbox.checked { background: var(--accent-cyan); border-color: var(--accent-cyan); }
        .question-info { flex: 1; min-width: 0; }
        .question-tags { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .tag { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
        .category { background: rgba(102,153,255,0.15); color: #6699ff; }
        .question-text-select { font-size: 13px; line-height: 1.5; color: var(--text-secondary); margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .question-select-item.selected .question-text-select { color: var(--text-primary); }
        .add-action-bar { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; flex-shrink: 0; }
      `}</style>
    </div>
  );
};
