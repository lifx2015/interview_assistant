import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface Question {
  id: string;
  content: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
  created_at?: string;
  updated_at?: string;
}

// Markdown 示例模板
const MARKDOWN_TEMPLATE = `## 分类：Java基础

### 题目1 [难度：中等]
请介绍一下Java中的HashMap实现原理。

### 题目2 [难度：困难]
什么是线程安全？如何保证线程安全？

## 分类：数据库

### 题目3 [难度：简单]
MySQL索引优化的策略有哪些？

### 题目4 [难度：中等]
解释数据库事务的ACID特性。
`;

const PAGE_SIZE = 10;

// ===== 创建题库弹框 =====
interface CreateBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

const CreateBankModal: React.FC<CreateBankModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onCreate(name.trim(), description.trim());
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📚 创建新题库</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label>题库名称 <span className="required">*</span></label>
              <input
                type="text"
                placeholder="例如：Java后端面试题"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                maxLength={50}
              />
              <span className="char-count">{name.length}/50</span>
            </div>
            <div className="form-field">
              <label>题库描述</label>
              <textarea
                placeholder="简单描述这个题库的内容或用途（可选）"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <span className="char-count">{description.length}/200</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? '创建中...' : '创建题库'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===== 导入题目弹框 =====
interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (markdown: string) => void;
  bankName: string;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, bankName }) => {
  const [markdown, setMarkdown] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [parsedQuestions, setParsedQuestions] = useState<Array<{category: string; content: string; difficulty: string}>>([]);

  useEffect(() => {
    if (isOpen) {
      setMarkdown('');
      setIsSubmitting(false);
      setActiveTab('edit');
      setParsedQuestions([]);
    }
  }, [isOpen]);

  // 解析 Markdown 预览
  const parseMarkdown = useCallback((md: string) => {
    const questions: Array<{category: string; content: string; difficulty: string}> = [];
    const lines = md.split('\n');
    let currentCategory = '';

    const categoryPattern = /^[#\s]*分类[:：]\s*(.+)$/;
    const titlePattern = /^[#\s]*(?:题目\s*\d*)?\s*\[?难度[:：]?\s*(简单|中等|困难|easy|medium|hard)\]?/i;
    const diffMap: Record<string, string> = {
      '简单': '简单', '易': '简单', 'easy': '简单',
      '中等': '中等', '中': '中等', 'medium': '中等',
      '困难': '困难', '难': '困难', 'hard': '困难',
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const catMatch = line.match(categoryPattern);
      if (catMatch) {
        currentCategory = catMatch[1].trim();
        continue;
      }

      const titleMatch = line.match(titlePattern);
      if (titleMatch) {
        const difficulty = diffMap[titleMatch[1].toLowerCase()] || '中等';
        i++;
        const contentLines: string[] = [];
        while (i < lines.length) {
          const nextLine = lines[i].trim();
          if (/^[#\s]*(?:题目|分类)/.test(nextLine) || nextLine.startsWith('##')) break;
          if (nextLine) contentLines.push(nextLine);
          i++;
        }
        i--;

        if (contentLines.length > 0) {
          questions.push({
            category: currentCategory || '未分类',
            content: contentLines.join('\n').trim(),
            difficulty,
          });
        }
      }
    }
    return questions;
  }, []);

  useEffect(() => {
    setParsedQuestions(parseMarkdown(markdown));
  }, [markdown, parseMarkdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markdown.trim()) return;
    setIsSubmitting(true);
    await onImport(markdown.trim());
    setIsSubmitting(false);
  };

  const loadTemplate = () => {
    setMarkdown(MARKDOWN_TEMPLATE);
    setActiveTab('edit');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>📥 批量导入题目</h3>
            <span className="modal-subtitle">导入到题库：{bankName}</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* 标签页切换 */}
            <div className="tab-header">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
                onClick={() => setActiveTab('edit')}
              >
                ✏️ 编辑
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                👁️ 预览 ({parsedQuestions.length} 题)
              </button>
              <button type="button" className="tab-btn tab-btn-template" onClick={loadTemplate}>
                📋 插入示例
              </button>
            </div>

            {/* 编辑模式 */}
            {activeTab === 'edit' && (
              <div className="edit-area">
                <textarea
                  className="markdown-editor"
                  placeholder="粘贴 Markdown 格式的题目...&#10;&#10;支持的格式：&#10;## 分类：Java基础&#10;### 题目1 [难度：中等]&#10;题目内容..."
                  value={markdown}
                  onChange={e => setMarkdown(e.target.value)}
                  rows={16}
                />
                <div className="editor-hint">
                  <span>💡 提示：使用 ## 分类：xxx 定义分类，### 题目 [难度：简单/中等/困难] 定义题目</span>
                </div>
              </div>
            )}

            {/* 预览模式 */}
            {activeTab === 'preview' && (
              <div className="preview-area">
                {parsedQuestions.length === 0 ? (
                  <div className="preview-empty">
                    <span>📝</span>
                    <p>暂无解析结果</p>
                    <span className="hint">在编辑页粘贴 Markdown 内容后，此处将显示解析出的题目列表</span>
                  </div>
                ) : (
                  <div className="preview-list">
                    {parsedQuestions.map((q, idx) => (
                      <div key={idx} className="preview-item">
                        <div className="preview-item-header">
                          <span className="preview-num">{idx + 1}</span>
                          <span className="preview-category">{q.category}</span>
                          <span className={`preview-difficulty difficulty-${q.difficulty}`}>
                            {q.difficulty}
                          </span>
                        </div>
                        <div className="preview-content">{q.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <div className="footer-info">
              {parsedQuestions.length > 0 && (
                <span className="parse-result">✓ 可导入 {parsedQuestions.length} 道题目</span>
              )}
            </div>
            <div className="footer-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                取消
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={parsedQuestions.length === 0 || isSubmitting}
              >
                {isSubmitting ? '导入中...' : `导入 ${parsedQuestions.length > 0 ? parsedQuestions.length + ' 题' : ''}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===== 确认删除弹框 =====
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, onClose, onConfirm, title, message, confirmText = '确认', cancelText = '取消', isDanger = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== 主页面 =====
export const QuestionBankPage: React.FC = () => {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 弹框状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteBankModal, setShowDeleteBankModal] = useState(false);
  const [showDeleteQuestionModal, setShowDeleteQuestionModal] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  // 编辑题目
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // 搜索和分页
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  // 加载所有题库
  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/question-bank/list');
      if (res.ok) {
        const data = await res.json();
        const bankList = data.banks || [];
        const fullBanks: QuestionBank[] = [];
        for (const bank of bankList) {
          const detailRes = await fetch(`/api/question-bank/${bank.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            fullBanks.push(detail);
          }
        }
        setBanks(fullBanks);
      }
    } catch (e) {
      console.error('Failed to fetch banks:', e);
    }
    setLoading(false);
  };

  // 创建新题库
  const createBank = async (name: string, description: string) => {
    try {
      const res = await fetch('/api/question-bank/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast('题库创建成功');
        setShowCreateModal(false);
        fetchBanks();
        if (data.bank) {
          const detailRes = await fetch(`/api/question-bank/${data.bank.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setSelectedBank(detail);
          }
        }
      }
    } catch (e) {
      console.error('Failed to create bank:', e);
      showToast('创建失败');
    }
  };

  // 显示 Toast 提示
  const showToast = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // 删除题库
  const handleDeleteBankClick = (bankId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBankToDelete(bankId);
    setShowDeleteBankModal(true);
  };

  const confirmDeleteBank = async () => {
    if (!bankToDelete) return;
    try {
      const res = await fetch(`/api/question-bank/${bankToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('题库已删除');
        if (selectedBank?.id === bankToDelete) setSelectedBank(null);
        fetchBanks();
      }
    } catch (e) {
      console.error('Failed to delete bank:', e);
    }
    setShowDeleteBankModal(false);
    setBankToDelete(null);
  };

  // 从 Markdown 导入
  const importFromMarkdown = async (markdown: string) => {
    if (!selectedBank) {
      showToast('请先选择题库');
      return;
    }

    try {
      const res = await fetch(`/api/question-bank/${selectedBank.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`成功导入 ${data.imported_count} 道题目`);
        setShowImportModal(false);
        fetchBanks();
        const detailRes = await fetch(`/api/question-bank/${selectedBank.id}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setSelectedBank(detail);
        }
      } else {
        const err = await res.json();
        showToast(err.detail || '导入失败');
      }
    } catch (e) {
      console.error('Failed to import:', e);
      showToast('导入失败');
    }
  };

  // 删除题目
  const handleDeleteQuestionClick = (questionId: string) => {
    setQuestionToDelete(questionId);
    setShowDeleteQuestionModal(true);
  };

  const confirmDeleteQuestion = async () => {
    if (!selectedBank || !questionToDelete) return;
    try {
      const res = await fetch(`/api/question-bank/${selectedBank.id}/questions/${questionToDelete}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('题目已删除');
        fetchBanks();
        const detailRes = await fetch(`/api/question-bank/${selectedBank.id}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setSelectedBank(detail);
        }
      }
    } catch (e) {
      console.error('Failed to delete question:', e);
    }
    setShowDeleteQuestionModal(false);
    setQuestionToDelete(null);
  };

  // 更新题目
  const updateQuestion = async () => {
    if (!selectedBank || !editingQuestion) return;
    try {
      const res = await fetch(`/api/question-bank/${selectedBank.id}/questions/${editingQuestion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editingQuestion.content,
          category: editingQuestion.category,
          difficulty: editingQuestion.difficulty,
        }),
      });
      if (res.ok) {
        showToast('题目已更新');
        setEditingQuestion(null);
        fetchBanks();
        const detailRes = await fetch(`/api/question-bank/${selectedBank.id}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setSelectedBank(detail);
        }
      }
    } catch (e) {
      console.error('Failed to update:', e);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  // 获取当前题库的所有题目并过滤
  const currentQuestions = useMemo(() => {
    if (!selectedBank) return [];
    let questions = selectedBank.questions || [];

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      questions = questions.filter(q =>
        q.content.toLowerCase().includes(keyword) ||
        (q.category && q.category.toLowerCase().includes(keyword))
      );
    }

    if (categoryFilter) {
      questions = questions.filter(q => q.category === categoryFilter);
    }

    if (difficultyFilter) {
      questions = questions.filter(q => q.difficulty === difficultyFilter);
    }

    return questions;
  }, [selectedBank, searchKeyword, categoryFilter, difficultyFilter]);

  // 获取所有分类选项
  const categories = useMemo(() => {
    if (!selectedBank) return [];
    const cats = new Set<string>();
    selectedBank.questions?.forEach(q => {
      if (q.category) cats.add(q.category);
    });
    return Array.from(cats);
  }, [selectedBank]);

  // 分页数据
  const totalPages = Math.ceil(currentQuestions.length / PAGE_SIZE);
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return currentQuestions.slice(start, start + PAGE_SIZE);
  }, [currentQuestions, currentPage]);

  // 切换题库时重置分页
  useEffect(() => {
    setCurrentPage(1);
    setSearchKeyword('');
    setCategoryFilter('');
    setDifficultyFilter('');
  }, [selectedBank?.id]);

  const goToInterview = () => {
    window.location.href = '/';
  };

  const getDifficultyLabel = (diff?: string) => {
    const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };
    return map[diff || ''] || diff || '未知';
  };

  const getDifficultyClass = (diff?: string) => {
    const map: Record<string, string> = { easy: 'easy', medium: 'medium', hard: 'hard' };
    return map[diff || ''] || '';
  };

  return (
    <div className="question-bank-page">
      <header className="page-header">
        <div className="header-brand">
          <div className="brand-icon">📚</div>
          <div>
            <h1>面试题库管理</h1>
            <span className="brand-subtitle">管理面试题目，支持批量导入</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={goToInterview}>
            <span>←</span> 返回面试
          </button>
        </div>
      </header>

      <div className="page-content">
        {/* 左侧：题库列表 */}
        <div className="banks-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">
              <span>题库列表</span>
              <span className="count-badge">{banks.length}</span>
            </div>
            <button className="btn btn-primary btn-icon-only" onClick={() => setShowCreateModal(true)} title="创建新题库">
              <span>+</span>
            </button>
          </div>

          <div className="banks-list">
            {loading && banks.length === 0 ? (
              <div className="loading-state">
                <div className="spinner" />
                <span>加载中...</span>
              </div>
            ) : banks.length === 0 ? (
              <div className="empty-state-small">
                <span>📝</span>
                <p>暂无题库</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
                  创建第一个题库
                </button>
              </div>
            ) : (
              banks.map(bank => (
                <div
                  key={bank.id}
                  className={`bank-item ${selectedBank?.id === bank.id ? 'active' : ''}`}
                  onClick={() => setSelectedBank(bank)}
                >
                  <div className="bank-item-content">
                    <div className="bank-item-main">
                      <span className="bank-name">{bank.name}</span>
                      <span className="question-count">{bank.questions?.length || 0} 题</span>
                    </div>
                    {bank.description && <p className="bank-desc">{bank.description}</p>}
                    <div className="bank-meta">
                      <span className="update-time">{bank.updated_at?.split(' ')[0]}</span>
                    </div>
                  </div>
                  <button
                    className="bank-delete-btn"
                    onClick={e => handleDeleteBankClick(bank.id, e)}
                    title="删除题库"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：题目列表 */}
        <div className="questions-main">
          {selectedBank ? (
            <>
              <div className="main-header">
                <div className="header-info">
                  <h2>{selectedBank.name}</h2>
                  {selectedBank.description && <p className="bank-desc">{selectedBank.description}</p>}
                </div>
                <div className="header-actions">
                  <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
                    <span>📥</span> 批量导入
                  </button>
                </div>
              </div>

              {/* 筛选栏 */}
              <div className="filter-bar">
                <div className="search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="搜索题目内容或分类..."
                    value={searchKeyword}
                    onChange={e => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
                  />
                  {searchKeyword && (
                    <button className="clear-search" onClick={() => setSearchKeyword('')}>×</button>
                  )}
                </div>
                <select
                  value={categoryFilter}
                  onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">全部分类</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={difficultyFilter}
                  onChange={e => { setDifficultyFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">全部难度</option>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
                <span className="result-count">共 {currentQuestions.length} 题</span>
              </div>

              {/* 题目表格 */}
              <div className="questions-table-container">
                <table className="questions-table">
                  <thead>
                    <tr>
                      <th className="col-num">序号</th>
                      <th className="col-content">题目内容</th>
                      <th className="col-category">分类</th>
                      <th className="col-difficulty">难度</th>
                      <th className="col-actions">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQuestions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-cell">
                          <div className="empty-content">
                            <span>{selectedBank.questions?.length === 0 ? '📝' : '🔍'}</span>
                            <p>{selectedBank.questions?.length === 0 ? '暂无题目，点击「批量导入」添加' : '无匹配题目'}</p>
                            {selectedBank.questions?.length === 0 && (
                              <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
                                批量导入题目
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedQuestions.map((q, idx) => {
                        const actualIndex = (currentPage - 1) * PAGE_SIZE + idx;
                        if (editingQuestion?.id === q.id) {
                          return (
                            <tr key={q.id} className="editing-row">
                              <td>{actualIndex + 1}</td>
                              <td>
                                <textarea
                                  value={editingQuestion.content}
                                  onChange={e => setEditingQuestion({ ...editingQuestion, content: e.target.value })}
                                  rows={2}
                                  autoFocus
                                />
                              </td>
                              <td>
                                <input
                                  value={editingQuestion.category || ''}
                                  onChange={e => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                                  placeholder="分类"
                                />
                              </td>
                              <td>
                                <select
                                  value={editingQuestion.difficulty || 'medium'}
                                  onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                                >
                                  <option value="easy">简单</option>
                                  <option value="medium">中等</option>
                                  <option value="hard">困难</option>
                                </select>
                              </td>
                              <td>
                                <div className="action-btns">
                                  <button className="btn btn-primary btn-sm" onClick={updateQuestion}>保存</button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingQuestion(null)}>取消</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={q.id}>
                            <td className="col-num">{actualIndex + 1}</td>
                            <td className="col-content">
                              <div className="question-text" title={q.content}>{q.content}</div>
                            </td>
                            <td className="col-category">
                              {q.category ? <span className="tag category">{q.category}</span> : '-'}
                            </td>
                            <td className="col-difficulty">
                              {q.difficulty ? (
                                <span className={`tag difficulty ${getDifficultyClass(q.difficulty)}`}>
                                  {getDifficultyLabel(q.difficulty)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="col-actions">
                              <div className="action-btns">
                                <button className="btn-icon" onClick={() => setEditingQuestion(q)} title="编辑">✏️</button>
                                <button className="btn-icon delete" onClick={() => handleDeleteQuestionClick(q.id)} title="删除">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    ← 上一页
                  </button>
                  <div className="page-numbers">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`page-num ${page === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    className="page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    下一页 →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-illustration">
                <span>📚</span>
              </div>
              <h3>请选择题库</h3>
              <p>从左侧列表选择一个题库查看和管理题目</p>
              {banks.length > 0 && (
                <button className="btn btn-primary" onClick={() => banks[0] && setSelectedBank(banks[0])}>
                  查看第一个题库
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div className="toast">
          <span className="toast-icon">✓</span>
          {message}
        </div>
      )}

      {/* 弹框 */}
      <CreateBankModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={createBank}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={importFromMarkdown}
        bankName={selectedBank?.name || ''}
      />

      <ConfirmModal
        isOpen={showDeleteBankModal}
        onClose={() => { setShowDeleteBankModal(false); setBankToDelete(null); }}
        onConfirm={confirmDeleteBank}
        title="🗑️ 删除题库"
        message="确定要删除这个题库吗？题库中的所有题目将被永久删除，此操作不可撤销。"
        confirmText="删除题库"
        isDanger
      />

      <ConfirmModal
        isOpen={showDeleteQuestionModal}
        onClose={() => { setShowDeleteQuestionModal(false); setQuestionToDelete(null); }}
        onConfirm={confirmDeleteQuestion}
        title="🗑️ 删除题目"
        message="确定要删除这道题目吗？此操作不可撤销。"
        confirmText="删除"
        isDanger
      />

      <style>{`
        /* ========== 基础变量 ========== */
        :root {
          --accent-cyan: #00d4ff;
          --accent-blue: #0066ff;
          --accent-green: #00ff88;
          --accent-amber: #ffaa00;
          --accent-red: #ff4466;
          --accent-purple: #8b5cf6;
          --bg-primary: #0a0c10;
          --bg-secondary: #11141b;
          --bg-tertiary: #1a1f2a;
          --bg-hover: #252b38;
          --border-color: #2a3140;
          --border-glow: #3a4560;
          --text-primary: #e8eaf0;
          --text-secondary: #9ca3b0;
          --text-muted: #6b7280;
        }

        .question-bank-page {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ========== 页面头部 ========== */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(139, 92, 246, 0.2));
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 10px;
          font-size: 20px;
        }

        .page-header h1 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .brand-subtitle {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* ========== 页面内容布局 ========== */
        .page-content {
          display: grid;
          grid-template-columns: 300px 1fr;
          height: calc(100vh - 73px);
        }

        /* ========== 左侧题库列表 ========== */
        .banks-sidebar {
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .sidebar-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .count-badge {
          padding: 2px 8px;
          background: rgba(0, 212, 255, 0.1);
          border-radius: 10px;
          font-size: 11px;
          color: var(--accent-cyan);
        }

        .banks-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .bank-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          margin-bottom: 4px;
          background: var(--bg-tertiary);
          border: 1px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .bank-item:hover {
          background: var(--bg-hover);
          border-color: var(--border-glow);
        }

        .bank-item.active {
          background: rgba(0, 212, 255, 0.08);
          border-color: var(--accent-cyan);
        }

        .bank-item-content {
          flex: 1;
          min-width: 0;
        }

        .bank-item-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
        }

        .bank-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .question-count {
          padding: 2px 6px;
          background: rgba(0, 212, 255, 0.1);
          border-radius: 4px;
          font-size: 11px;
          color: var(--accent-cyan);
          white-space: nowrap;
        }

        .bank-desc {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0 0 8px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bank-meta {
          font-size: 11px;
          color: var(--text-muted);
        }

        .bank-delete-btn {
          padding: 4px;
          border: none;
          background: transparent;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          font-size: 14px;
        }

        .bank-item:hover .bank-delete-btn {
          opacity: 0.5;
        }

        .bank-delete-btn:hover {
          opacity: 1 !important;
          transform: scale(1.1);
        }

        /* ========== 右侧主内容区 ========== */
        .questions-main {
          padding: 20px 24px;
          overflow-y: auto;
          background: var(--bg-primary);
        }

        .main-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .header-info h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .header-info .bank-desc {
          font-size: 13px;
          color: var(--text-muted);
          margin: 0;
        }

        /* ========== 按钮样式 ========== */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
          font-weight: 500;
        }

        .btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-glow);
        }

        .btn-primary {
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 102, 255, 0.1));
          border-color: rgba(0, 212, 255, 0.3);
          color: var(--accent-cyan);
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.25), rgba(0, 102, 255, 0.15));
          border-color: var(--accent-cyan);
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.15);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-secondary);
        }

        .btn-secondary:hover {
          color: var(--text-primary);
          border-color: var(--border-glow);
        }

        .btn-danger {
          background: rgba(255, 68, 102, 0.15);
          border-color: rgba(255, 68, 102, 0.3);
          color: var(--accent-red);
        }

        .btn-danger:hover {
          background: rgba(255, 68, 102, 0.25);
          border-color: var(--accent-red);
        }

        .btn-sm { padding: 6px 12px; font-size: 12px; }
        .btn-icon-only { padding: 8px; }

        .btn-icon {
          padding: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          opacity: 0.6;
          transition: all 0.2s;
          border-radius: 4px;
        }

        .btn-icon:hover {
          opacity: 1;
          background: rgba(0, 212, 255, 0.1);
        }

        .btn-icon.delete:hover {
          background: rgba(255, 68, 102, 0.1);
        }

        /* ========== 筛选栏 ========== */
        .filter-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .search-box {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          font-size: 14px;
          opacity: 0.5;
        }

        .search-box input {
          width: 100%;
          padding: 8px 32px 8px 36px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
          transition: all 0.2s;
        }

        .search-box input:focus {
          outline: none;
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
        }

        .clear-search {
          position: absolute;
          right: 8px;
          padding: 2px 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 16px;
          line-height: 1;
        }

        .clear-search:hover {
          color: var(--text-primary);
        }

        .filter-bar select {
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
          min-width: 100px;
          cursor: pointer;
        }

        .filter-bar select:focus {
          outline: none;
          border-color: var(--accent-cyan);
        }

        .result-count {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
        }

        /* ========== 题目表格 ========== */
        .questions-table-container {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
        }

        .questions-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .questions-table th {
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          text-align: left;
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .questions-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          vertical-align: top;
        }

        .questions-table tr:last-child td {
          border-bottom: none;
        }

        .questions-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .col-num { width: 50px; text-align: center; color: var(--text-muted); }
        .col-content { flex: 1; }
        .col-category { width: 120px; }
        .col-difficulty { width: 80px; }
        .col-actions { width: 100px; text-align: center; }

        .question-text {
          max-height: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .tag {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .tag.category {
          background: rgba(102, 153, 255, 0.12);
          color: #6699ff;
        }

        .tag.difficulty.easy {
          background: rgba(0, 255, 136, 0.12);
          color: var(--accent-green);
        }

        .tag.difficulty.medium {
          background: rgba(255, 170, 0, 0.12);
          color: var(--accent-amber);
        }

        .tag.difficulty.hard {
          background: rgba(255, 68, 102, 0.12);
          color: var(--accent-red);
        }

        .action-btns {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .editing-row {
          background: rgba(0, 212, 255, 0.05) !important;
        }

        .editing-row td {
          padding: 8px 12px;
        }

        .editing-row textarea,
        .editing-row input,
        .editing-row select {
          width: 100%;
          padding: 8px 12px;
          background: var(--bg-primary);
          border: 1px solid var(--accent-cyan);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .editing-row textarea {
          resize: vertical;
          min-height: 60px;
        }

        .editing-row textarea:focus,
        .editing-row input:focus,
        .editing-row select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
        }

        /* ========== 分页 ========== */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
        }

        .page-btn {
          padding: 8px 16px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }

        .page-btn:hover:not(:disabled) {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        .page-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .page-numbers {
          display: flex;
          gap: 4px;
        }

        .page-num {
          min-width: 32px;
          height: 32px;
          padding: 0 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }

        .page-num:hover {
          border-color: var(--border-glow);
          color: var(--text-primary);
        }

        .page-num.active {
          background: var(--accent-cyan);
          border-color: var(--accent-cyan);
          color: #000;
          font-weight: 600;
        }

        /* ========== 空状态 ========== */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--text-muted);
        }

        .empty-illustration {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          margin-bottom: 16px;
          font-size: 36px;
        }

        .empty-state h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }

        .empty-state p {
          margin: 0 0 20px 0;
          font-size: 13px;
        }

        .empty-state-small {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: var(--text-muted);
        }

        .empty-state-small span:first-child {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .empty-state-small p {
          margin: 0 0 16px 0;
          font-size: 13px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: var(--text-muted);
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-color);
          border-top-color: var(--accent-cyan);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-cell {
          padding: 60px 20px !important;
        }

        .empty-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          color: var(--text-muted);
        }

        .empty-content span:first-child {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .empty-content p {
          margin: 0 0 16px 0;
        }

        /* ========== Toast ========== */
        .toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--accent-cyan);
          border-radius: 8px;
          color: var(--accent-cyan);
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease;
          z-index: 1000;
        }

        .toast-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-cyan);
          color: #000;
          border-radius: 50%;
          font-size: 12px;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* ========== 弹框样式 ========== */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: fadeIn 0.2s ease;
          padding: 20px;
        }

        .modal-content {
          width: 100%;
          max-width: 440px;
          max-height: 90vh;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: scaleIn 0.2s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-content.modal-large {
          max-width: 700px;
        }

        .modal-content.modal-small {
          max-width: 400px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .modal-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .modal-subtitle {
          font-size: 12px;
          color: var(--text-muted);
        }

        .modal-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 20px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-tertiary);
        }

        .modal-footer .footer-info {
          flex: 1;
        }

        .modal-footer .footer-actions {
          display: flex;
          gap: 12px;
        }

        .parse-result {
          font-size: 13px;
          color: var(--accent-green);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* 表单字段 */
        .form-field {
          margin-bottom: 16px;
          position: relative;
        }

        .form-field:last-child {
          margin-bottom: 0;
        }

        .form-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }

        .form-field .required {
          color: var(--accent-red);
        }

        .form-field input,
        .form-field textarea {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-field input:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
        }

        .form-field textarea {
          resize: vertical;
          min-height: 80px;
          font-family: inherit;
        }

        .char-count {
          position: absolute;
          right: 10px;
          bottom: 10px;
          font-size: 11px;
          color: var(--text-muted);
        }

        .confirm-message {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-secondary);
        }

        /* 导入弹框标签页 */
        .tab-header {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 16px;
          padding: 4px;
          background: var(--bg-tertiary);
          border-radius: 8px;
        }

        .tab-btn {
          flex: 1;
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .tab-btn:hover {
          color: var(--text-primary);
        }

        .tab-btn.active {
          background: var(--bg-secondary);
          color: var(--accent-cyan);
          font-weight: 500;
        }

        .tab-btn-template {
          flex: 0 0 auto;
          padding: 8px 12px;
          background: transparent;
          border: 1px dashed var(--border-color);
        }

        .tab-btn-template:hover {
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        /* 编辑区域 */
        .edit-area {
          display: flex;
          flex-direction: column;
        }

        .markdown-editor {
          width: 100%;
          padding: 12px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
          resize: vertical;
          min-height: 280px;
        }

        .markdown-editor:focus {
          outline: none;
          border-color: var(--accent-cyan);
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
        }

        .editor-hint {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }

        /* 预览区域 */
        .preview-area {
          min-height: 300px;
          max-height: 400px;
          overflow-y: auto;
        }

        .preview-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: var(--text-muted);
          text-align: center;
        }

        .preview-empty span:first-child {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .preview-empty p {
          font-size: 16px;
          font-weight: 500;
          margin: 0 0 8px 0;
          color: var(--text-secondary);
        }

        .preview-empty .hint {
          font-size: 13px;
          max-width: 300px;
        }

        .preview-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preview-item {
          padding: 12px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .preview-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .preview-num {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-cyan);
          color: #000;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 600;
        }

        .preview-category {
          padding: 2px 8px;
          background: rgba(102, 153, 255, 0.15);
          border-radius: 4px;
          font-size: 11px;
          color: #6699ff;
        }

        .preview-difficulty {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .preview-difficulty.difficulty-简单 {
          background: rgba(0, 255, 136, 0.15);
          color: var(--accent-green);
        }

        .preview-difficulty.difficulty-中等 {
          background: rgba(255, 170, 0, 0.15);
          color: var(--accent-amber);
        }

        .preview-difficulty.difficulty-困难 {
          background: rgba(255, 68, 102, 0.15);
          color: var(--accent-red);
        }

        .preview-content {
          font-size: 13px;
          color: var(--text-primary);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};
