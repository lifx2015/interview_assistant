import React, { useState, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import styles from './QuestionPanel.module.css';
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
  lastFollowUpRaw: string;
  onGenerate: () => void;
  bankQuestionGroups?: BankQuestionGroup[];
  onAddBankGroup?: (group: BankQuestionGroup) => void;
  onRemoveBankGroup?: (bankId: string) => void;
}

export const QuestionPanel: React.FC<Props> = ({
  isGenerating,
  questionsRaw,
  followUpRaw,
  lastFollowUpRaw,
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
  const hasLastFollowUp = lastFollowUpRaw.length > 0;
  const hasQuestions = questionsRaw.length > 0;

  // P1-2: Split follow-up content into questions and risk sections
  const splitFollowUp = (raw: string): { followUp: string; risk: string } => {
    const sep = '---FOLLOWUP---';
    const idx = raw.indexOf(sep);
    if (idx === -1) return { followUp: raw, risk: '' };
    return { followUp: raw.slice(0, idx).trim(), risk: raw.slice(idx + sep.length).trim() };
  };

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
    <div className={styles['question-panel']}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'preset' ? styles.active : ''}`} onClick={() => setActiveTab('preset')}>
          预设问题
          {hasQuestions && <span className={styles['tab-badge']}>✓</span>}
        </button>
        <button className={`${styles.tab} ${activeTab === 'followup' ? styles.active : ''}`} onClick={() => setActiveTab('followup')}>
          实时追问
          {hasFollowUp && <span className={styles['tab-badge']}>NEW</span>}
          {!hasFollowUp && hasLastFollowUp && <span className={styles['tab-badge']} style={{ background: 'rgba(255,170,0,0.15)', color: 'var(--accent-amber)' }}>历史</span>}
        </button>
        {bankQuestionGroups.map(group => (
          <button
            key={group.bankId}
            className={`${styles.tab} ${activeTab === `bank_${group.bankId}` ? styles.active : ''}`}
            onClick={() => setActiveTab(`bank_${group.bankId}`)}
          >
            {group.bankName}
            <span className={styles['tab-badge']}>{group.questions.length}</span>
            <span onClick={e => { e.stopPropagation(); removeBankGroup(group.bankId); }} style={{ marginLeft: 4, opacity: 0.5 }}>×</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'preset' && (
          <>
            {questionsRaw ? (
              <MarkdownRenderer content={questionsRaw} isStreaming={isGenerating} />
            ) : (
              <div className={styles['empty-state']}>
                <p>点击下方「生成题目」基于简历自动生成面试问题</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'followup' && (
          <>
            {followUpRaw ? (
              <div className={styles['follow-up-section']}>
                <div className={styles['follow-up-header']}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'pulse-dot 1s ease-in-out infinite' }} />
                  基于候选人回答实时生成
                </div>
                {(() => {
                  const { followUp, risk } = splitFollowUp(followUpRaw);
                  return (
                    <>
                      {followUp && (
                        <div className={styles['follow-up-block']}>
                          <div className={styles['follow-up-block-label']}>追问建议</div>
                          <div className={styles['follow-up-content']}>
                            <MarkdownRenderer content={followUp} isStreaming={true} />
                          </div>
                        </div>
                      )}
                      {risk && (
                        <div className={styles['follow-up-block']}>
                          <div className={`${styles['follow-up-block-label']} ${styles['risk-label']}`}>风险提示</div>
                          <div className={styles['follow-up-content']}>
                            <MarkdownRenderer content={risk} isStreaming={true} />
                          </div>
                        </div>
                      )}
                      {!followUp && !risk && (
                        <div className={styles['follow-up-content']}>
                          <MarkdownRenderer content={followUpRaw} isStreaming={true} />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : lastFollowUpRaw ? (
              <div className={styles['follow-up-section']}>
                <div className={styles['follow-up-header']} style={{ opacity: 0.6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-amber)' }} />
                  上一轮追问建议
                </div>
                {(() => {
                  const { followUp, risk } = splitFollowUp(lastFollowUpRaw);
                  return (
                    <>
                      {followUp && (
                        <div className={styles['follow-up-block']}>
                          <div className={styles['follow-up-block-label']}>追问建议</div>
                          <div className={styles['follow-up-content']}>
                            <MarkdownRenderer content={followUp} isStreaming={false} />
                          </div>
                        </div>
                      )}
                      {risk && (
                        <div className={styles['follow-up-block']}>
                          <div className={`${styles['follow-up-block-label']} ${styles['risk-label']}`}>风险提示</div>
                          <div className={styles['follow-up-content']}>
                            <MarkdownRenderer content={risk} isStreaming={false} />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className={styles['empty-state']}>
                <p>候选人回答时将实时生成追问建议</p>
              </div>
            )}
          </>
        )}

        {bankQuestionGroups.map(group =>
          activeTab === `bank_${group.bankId}` ? (
            <div key={group.bankId} className={styles['bank-section']}>
              <div className={styles['bank-header']}>
                <div className={styles['bank-name']}>
                  {group.bankName}
                  <span className={styles['bank-count']}>{group.questions.length} 道题</span>
                </div>
                <button className={styles['bank-remove-btn']} onClick={() => removeBankGroup(group.bankId)}>移除题库</button>
              </div>
              {group.questions.map((q, idx) => {
                const diff = getDifficultyStyle(q.difficulty);
                return (
                  <div key={q.id} className={styles['question-card']}>
                    <div className={styles['question-header']}>
                      <span className={styles['question-number']}>#{idx + 1}</span>
                      {q.category && <span className={styles['category-label']}>{q.category}</span>}
                      <span className={styles['difficulty-tag']} style={{ background: diff.bg, color: diff.color }}>
                        {diff.label}
                      </span>
                    </div>
                    <div className={styles['question-text']}>{q.content}</div>
                  </div>
                );
              })}
            </div>
          ) : null
        )}
      </div>

      <div className={styles['floating-actions']}>
        <button
          className={styles['generate-btn']}
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className={styles['generating-spinner']} />
              生成中...
            </>
          ) : (
            '⚡ 生成题目'
          )}
        </button>
        <button
          className={`${styles['generate-btn']} ${styles['bank-btn']}`}
          onClick={openBankSelector}
        >
          📚 添加题库
        </button>
      </div>

      {showBankSelector && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowBankSelector(false)}>
          <div style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>选择题库</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>展开题库并选择要添加的题目</p>
              </div>
              <button style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', borderRadius: 6 }} onClick={() => setShowBankSelector(false)}>×</button>
            </div>

            {loadingBanks ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div className={styles['generating-spinner']} />
                <span>加载中...</span>
              </div>
            ) : banks.length === 0 ? (
              <div className={styles['bank-empty']}>
                <span style={{ fontSize: 48, opacity: 0.5 }}>📚</span>
                <p>暂无题库</p>
                <a href="/question-bank" target="_blank" className={styles['bank-link']}>去创建题库 →</a>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {banks.map(bank => {
                  const isExpanded = expandedBankId === bank.id;
                  const selectedCount = selectedQuestionIds[bank.id]?.size || 0;
                  return (
                    <div key={bank.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', cursor: 'pointer', background: 'rgba(0,0,0,0.2)' }} onClick={() => setExpandedBankId(isExpanded ? null : bank.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{bank.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bank.questions.length} 道题</span>
                          {selectedCount > 0 && <span style={{ padding: '3px 10px', background: 'rgba(139,92,246,0.2)', borderRadius: 12, fontSize: 11, color: '#a78bfa' }}>已选 {selectedCount} 题</span>}
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border-color)' }}>
                          {bank.questions.length === 0 ? (
                            <p className={styles['bank-empty']}>题库为空</p>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed var(--border-color)' }}>
                                <button style={{ padding: '4px 12px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }} onClick={() => toggleSelectAll(bank)}>
                                  {selectedCount === bank.questions.length ? '取消全选' : '全选'}
                                </button>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>已选择 {selectedCount} / {bank.questions.length} 题</span>
                              </div>
                              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {bank.questions.map(q => {
                                  const isSelected = selectedQuestionIds[bank.id]?.has(q.id);
                                  const diff = getDifficultyStyle(q.difficulty);
                                  return (
                                    <div
                                      key={q.id}
                                      style={{ display: 'flex', gap: 12, padding: '10px 12px', background: isSelected ? 'rgba(0,212,255,0.05)' : 'rgba(0,0,0,0.2)', border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid transparent', borderRadius: 8, cursor: 'pointer' }}
                                      onClick={() => toggleQuestionSelection(bank.id, q.id)}
                                    >
                                      <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: isSelected ? 'none' : '2px solid var(--border-color)', borderRadius: 4, background: isSelected ? 'var(--accent-cyan)' : 'transparent', color: isSelected ? '#fff' : 'transparent', fontSize: 11 }}>
                                        {isSelected && '✓'}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                          {q.category && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: 'rgba(102,153,255,0.15)', color: '#6699ff' }}>{q.category}</span>}
                                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: diff.bg, color: diff.color }}>{diff.label}</span>
                                        </div>
                                        <p style={{ fontSize: 13, lineHeight: 1.5, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', margin: 0 }}>{q.content}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={() => confirmAddQuestions(bank)} disabled={selectedCount === 0}>
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
    </div>
  );
};