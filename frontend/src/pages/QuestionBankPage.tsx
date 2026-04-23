import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './QuestionBankPage.module.css';

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
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={styles['modal-content']} onClick={e => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <h3>📚 创建新题库</h3>
          <button className={styles['modal-close']} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles['modal-body']}>
            <div className={styles['form-field']}>
              <label>题库名称 <span className={styles.required}>*</span></label>
              <input
                type="text"
                placeholder="例如：Java后端面试题"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                maxLength={50}
              />
              <span className={styles['char-count']}>{name.length}/50</span>
            </div>
            <div className={styles['form-field']}>
              <label>题库描述</label>
              <textarea
                placeholder="简单描述这个题库的内容或用途（可选）"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <span className={styles['char-count']}>{description.length}/200</span>
            </div>
          </div>
          <div className={styles['modal-footer']}>
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
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={`${styles['modal-content']} ${styles['modal-large']}`} onClick={e => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <div>
            <h3>📥 批量导入题目</h3>
            <span className={styles['modal-subtitle']}>导入到题库：{bankName}</span>
          </div>
          <button className={styles['modal-close']} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles['modal-body']}>
            {/* 标签页切换 */}
            <div className={styles['tab-header']}>
              <button
                type="button"
                className={`${styles['tab-btn']} ${activeTab === 'edit' ? styles.active : ''}`}
                onClick={() => setActiveTab('edit')}
              >
                ✏️ 编辑
              </button>
              <button
                type="button"
                className={`${styles['tab-btn']} ${activeTab === 'preview' ? styles.active : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                👁️ 预览 ({parsedQuestions.length} 题)
              </button>
              <button type="button" className={`${styles['tab-btn']} ${styles['tab-btn-template']}`} onClick={loadTemplate}>
                📋 插入示例
              </button>
            </div>

            {/* 编辑模式 */}
            {activeTab === 'edit' && (
              <div className={styles['edit-area']}>
                <textarea
                  className={styles['markdown-editor']}
                  placeholder="粘贴 Markdown 格式的题目...&#10;&#10;支持的格式：&#10;## 分类：Java基础&#10;### 题目1 [难度：中等]&#10;题目内容..."
                  value={markdown}
                  onChange={e => setMarkdown(e.target.value)}
                  rows={16}
                />
                <div className={styles['editor-hint']}>
                  <span>💡 提示：使用 ## 分类：xxx 定义分类，### 题目 [难度：简单/中等/困难] 定义题目</span>
                </div>
              </div>
            )}

            {/* 预览模式 */}
            {activeTab === 'preview' && (
              <div className={styles['preview-area']}>
                {parsedQuestions.length === 0 ? (
                  <div className={styles['preview-empty']}>
                    <span>📝</span>
                    <p>暂无解析结果</p>
                    <span className={styles.hint}>在编辑页粘贴 Markdown 内容后，此处将显示解析出的题目列表</span>
                  </div>
                ) : (
                  <div className={styles['preview-list']}>
                    {parsedQuestions.map((q, idx) => (
                      <div key={idx} className={styles['preview-item']}>
                        <div className={styles['preview-item-header']}>
                          <span className={styles['preview-num']}>{idx + 1}</span>
                          <span className={styles['preview-category']}>{q.category}</span>
                          <span className={`${styles['preview-difficulty']} ${styles[`difficulty-${q.difficulty}`]}`}>
                            {q.difficulty}
                          </span>
                        </div>
                        <div className={styles['preview-content']}>{q.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={styles['modal-footer']}>
            <div className={styles['footer-info']}>
              {parsedQuestions.length > 0 && (
                <span className={styles['parse-result']}>✓ 可导入 {parsedQuestions.length} 道题目</span>
              )}
            </div>
            <div className={styles['footer-actions']}>
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
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={`${styles['modal-content']} ${styles['modal-small']}`} onClick={e => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <h3>{title}</h3>
          <button className={styles['modal-close']} onClick={onClose}>×</button>
        </div>
        <div className={styles['modal-body']}>
          <p className={styles['confirm-message']}>{message}</p>
        </div>
        <div className={styles['modal-footer']}>
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
    <div className={styles['question-bank-page']}>
      <header className={styles['page-header']}>
        <div className={styles['header-brand']}>
          <div className={styles['brand-icon']}>📚</div>
          <div>
            <h1>面试题库管理</h1>
            <span className={styles['brand-subtitle']}>管理面试题目，支持批量导入</span>
          </div>
        </div>
        <div className={styles['header-actions']}>
          <button className="btn btn-secondary" onClick={goToInterview}>
            <span>←</span> 返回面试
          </button>
        </div>
      </header>

      <div className={styles['page-content']}>
        {/* 左侧：题库列表 */}
        <div className={styles['banks-sidebar']}>
          <div className={styles['sidebar-header']}>
            <div className={styles['sidebar-title']}>
              <span>题库列表</span>
              <span className={styles['count-badge']}>{banks.length}</span>
            </div>
            <button className={`btn btn-primary ${styles['btn-icon-only']}`} onClick={() => setShowCreateModal(true)} title="创建新题库">
              <span>+</span>
            </button>
          </div>

          <div className={styles['banks-list']}>
            {loading && banks.length === 0 ? (
              <div className={styles['loading-state']}>
                <div className={styles.spinner} />
                <span>加载中...</span>
              </div>
            ) : banks.length === 0 ? (
              <div className={styles['empty-state-small']}>
                <span>📝</span>
                <p>暂无题库</p>
                <button className={`btn btn-primary ${styles['btn-sm']}`} onClick={() => setShowCreateModal(true)}>
                  创建第一个题库
                </button>
              </div>
            ) : (
              banks.map(bank => (
                <div
                  key={bank.id}
                  className={`${styles['bank-item']} ${selectedBank?.id === bank.id ? styles.active : ''}`}
                  onClick={() => setSelectedBank(bank)}
                >
                  <div className={styles['bank-item-content']}>
                    <div className={styles['bank-item-main']}>
                      <span className={styles['bank-name']}>{bank.name}</span>
                      <span className={styles['question-count']}>{bank.questions?.length || 0} 题</span>
                    </div>
                    {bank.description && <p className={styles['bank-desc']}>{bank.description}</p>}
                    <div className={styles['bank-meta']}>
                      <span className={styles['update-time']}>{bank.updated_at?.split(' ')[0]}</span>
                    </div>
                  </div>
                  <button
                    className={styles['bank-delete-btn']}
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
        <div className={styles['questions-main']}>
          {selectedBank ? (
            <>
              <div className={styles['main-header']}>
                <div className={styles['header-info']}>
                  <h2>{selectedBank.name}</h2>
                  {selectedBank.description && <p className={styles['bank-desc']}>{selectedBank.description}</p>}
                </div>
                <div className={styles['header-actions']}>
                  <button className="btn btn-primary" onClick={() => setShowImportModal(true)}>
                    <span>📥</span> 批量导入
                  </button>
                </div>
              </div>

              {/* 筛选栏 */}
              <div className={styles['filter-bar']}>
                <div className={styles['search-box']}>
                  <span className={styles['search-icon']}>🔍</span>
                  <input
                    type="text"
                    placeholder="搜索题目内容或分类..."
                    value={searchKeyword}
                    onChange={e => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
                  />
                  {searchKeyword && (
                    <button className={styles['clear-search']} onClick={() => setSearchKeyword('')}>×</button>
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
                <span className={styles['result-count']}>共 {currentQuestions.length} 题</span>
              </div>

              {/* 题目表格 */}
              <div className={styles['questions-table-container']}>
                <table className={styles['questions-table']}>
                  <thead>
                    <tr>
                      <th className={styles['col-num']}>序号</th>
                      <th className={styles['col-content']}>题目内容</th>
                      <th className={styles['col-category']}>分类</th>
                      <th className={styles['col-difficulty']}>难度</th>
                      <th className={styles['col-actions']}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQuestions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles['empty-cell']}>
                          <div className={styles['empty-content']}>
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
                            <tr key={q.id} className={styles['editing-row']}>
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
                                <div className={styles['action-btns']}>
                                  <button className={`btn btn-primary ${styles['btn-sm']}`} onClick={updateQuestion}>保存</button>
                                  <button className={`btn btn-secondary ${styles['btn-sm']}`} onClick={() => setEditingQuestion(null)}>取消</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={q.id}>
                            <td className={styles['col-num']}>{actualIndex + 1}</td>
                            <td className={styles['col-content']}>
                              <div className={styles['question-text']} title={q.content}>{q.content}</div>
                            </td>
                            <td className={styles['col-category']}>
                              {q.category ? <span className={`${styles.tag} ${styles.category}`}>{q.category}</span> : '-'}
                            </td>
                            <td className={styles['col-difficulty']}>
                              {q.difficulty ? (
                                <span className={`${styles.tag} ${styles.difficulty} ${styles[getDifficultyClass(q.difficulty)]}`}>
                                  {getDifficultyLabel(q.difficulty)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className={styles['col-actions']}>
                              <div className={styles['action-btns']}>
                                <button className={styles['btn-icon']} onClick={() => setEditingQuestion(q)} title="编辑">✏️</button>
                                <button className={`${styles['btn-icon']} ${styles.delete}`} onClick={() => handleDeleteQuestionClick(q.id)} title="删除">🗑️</button>
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
                <div className={styles.pagination}>
                  <button
                    className={styles['page-btn']}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    ← 上一页
                  </button>
                  <div className={styles['page-numbers']}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`${styles['page-num']} ${page === currentPage ? styles.active : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    className={styles['page-btn']}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    下一页 →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles['empty-state']}>
              <div className={styles['empty-illustration']}>
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
        <div className={styles.toast}>
          <span className={styles['toast-icon']}>✓</span>
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
    </div>
  );
};
