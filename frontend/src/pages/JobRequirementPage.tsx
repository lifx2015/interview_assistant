import React, { useState, useEffect, useCallback } from 'react';
import styles from './JobRequirementPage.module.css';
import type { JobRequirement } from '../types';

function JobRequirementPage() {
  const [requirements, setRequirements] = useState<JobRequirement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedRequirement = requirements.find(r => r.id === selectedId) || null;

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await fetch('/api/job-requirement/list');
      const data = await res.json();
      setRequirements(data.requirements || []);
    } catch {
      showToast('获取岗位列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/job-requirement/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), description: createDescription.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('岗位创建成功');
        setShowCreateModal(false);
        setCreateName('');
        setCreateDescription('');
        await fetchRequirements();
        setSelectedId(data.requirement.id);
      } else {
        showToast(data.detail || '创建失败', 'error');
      }
    } catch {
      showToast('创建失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/job-requirement/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('更新成功');
        setEditing(false);
        await fetchRequirements();
      } else {
        showToast(data.detail || '更新失败', 'error');
      }
    } catch {
      showToast('更新失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/job-requirement/${selectedId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('删除成功');
        setShowDeleteConfirm(false);
        setSelectedId(null);
        setEditing(false);
        await fetchRequirements();
      } else {
        showToast(data.detail || '删除失败', 'error');
      }
    } catch {
      showToast('删除失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    if (!selectedRequirement) return;
    setEditName(selectedRequirement.name);
    setEditDescription(selectedRequirement.description);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditName('');
    setEditDescription('');
  };

  return (
    <div className={styles['job-requirement-page']}>
      {/* Header */}
      <header className={styles['page-header']}>
        <div className={styles['header-brand']}>
          <div className={styles['brand-icon']}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div>
            <h1>岗位要求管理</h1>
            <div className={styles['brand-subtitle']}>管理面试岗位要求，辅助面试评估</div>
          </div>
        </div>
        <div className={styles['header-actions']}>
          <button className={styles['btn-back']} onClick={() => window.location.href = '/'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
            返回面试
          </button>
        </div>
      </header>

      {/* Content */}
      <div className={styles['page-content']}>
        {/* Left sidebar */}
        <aside className={styles['requirements-sidebar']}>
          <div className={styles['sidebar-header']}>
            <div className={styles['sidebar-title']}>
              岗位列表
              <span className={styles['count-badge']}>{requirements.length}</span>
            </div>
            <button className={styles['btn-create']} onClick={() => setShowCreateModal(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新增
            </button>
          </div>

          {loading ? (
            <div className={styles['loading-state']}>
              <div className={styles.spinner} />
              加载中...
            </div>
          ) : requirements.length === 0 ? (
            <div className={styles['empty-state-small']}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <p>暂无岗位要求</p>
              <button className={styles['btn-create']} onClick={() => setShowCreateModal(true)}>
                创建第一个岗位
              </button>
            </div>
          ) : (
            <div className={styles['requirements-list']}>
              {requirements.map(jr => (
                <div
                  key={jr.id}
                  className={`${styles['requirement-item']} ${selectedId === jr.id ? styles.active : ''}`}
                  onClick={() => { setSelectedId(jr.id); setEditing(false); }}
                >
                  <div className={styles['requirement-item-content']}>
                    <div className={styles['requirement-item-main']}>
                      <span className={styles['requirement-name']}>{jr.name}</span>
                    </div>
                    {jr.description && (
                      <p className={styles['requirement-desc']}>{jr.description}</p>
                    )}
                    <div className={styles['requirement-meta']}>
                      {jr.updated_at ? `更新于 ${jr.updated_at}` : ''}
                    </div>
                  </div>
                  <button
                    className={styles['requirement-delete-btn']}
                    onClick={e => { e.stopPropagation(); setSelectedId(jr.id); setShowDeleteConfirm(true); }}
                    title="删除"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Right detail panel */}
        <main className={styles['requirement-detail']}>
          {!selectedRequirement ? (
            <div className={styles['empty-state']}>
              <div className={styles['empty-illustration']}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h3>选择一个岗位查看详情</h3>
              <p>从左侧列表选择或创建新岗位</p>
            </div>
          ) : editing ? (
            <div className={styles['edit-form']}>
              <div className={styles['form-field']}>
                <label>岗位名称 <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="输入岗位名称"
                  maxLength={100}
                />
              </div>
              <div className={styles['form-field']}>
                <label>岗位要求描述</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="输入岗位要求描述，如技能要求、经验要求、学历要求等"
                  maxLength={5000}
                />
              </div>
              <div className={styles['edit-actions']}>
                <button className={styles['btn-cancel']} onClick={cancelEditing} disabled={saving}>
                  取消
                </button>
                <button className={styles['btn-save']} onClick={handleUpdate} disabled={saving || !editName.trim()}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles['detail-header']}>
                <div>
                  <h2>{selectedRequirement.name}</h2>
                  <p className={styles['detail-meta']}>
                    {selectedRequirement.created_at ? `创建于 ${selectedRequirement.created_at}` : ''}
                    {selectedRequirement.updated_at && selectedRequirement.updated_at !== selectedRequirement.created_at
                      ? ` · 更新于 ${selectedRequirement.updated_at}` : ''}
                  </p>
                </div>
                <div className={styles['detail-actions']}>
                  <button className={styles['btn-edit']} onClick={startEditing}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    编辑
                  </button>
                  <button className={styles['btn-delete']} onClick={() => setShowDeleteConfirm(true)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    删除
                  </button>
                </div>
              </div>
              {selectedRequirement.description ? (
                <div className={styles['detail-description']}>
                  {selectedRequirement.description}
                </div>
              ) : (
                <div className={styles['detail-description']} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  暂无岗位要求描述，点击编辑添加
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className={styles['modal-overlay']} onClick={() => setShowCreateModal(false)}>
          <div className={styles['modal-content']} onClick={e => e.stopPropagation()}>
            <div className={styles['modal-header']}>
              <h3>新增岗位要求</h3>
              <button className={styles['modal-close']} onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className={styles['modal-body']}>
              <div className={styles['form-field']}>
                <label>岗位名称 <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="例如：高级前端工程师"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className={styles['form-field']}>
                <label>岗位要求描述</label>
                <textarea
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  placeholder="输入岗位要求描述，如技能要求、经验要求、学历要求等"
                  maxLength={5000}
                />
              </div>
            </div>
            <div className={styles['modal-footer']}>
              <button className={styles['btn-cancel-modal']} onClick={() => setShowCreateModal(false)}>
                取消
              </button>
              <button
                className={styles['btn-confirm']}
                onClick={handleCreate}
                disabled={saving || !createName.trim()}
              >
                {saving ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && selectedRequirement && (
        <div className={styles['modal-overlay']} onClick={() => setShowDeleteConfirm(false)}>
          <div className={`${styles['modal-content']} ${styles['modal-small']}`} onClick={e => e.stopPropagation()}>
            <div className={styles['modal-header']}>
              <h3>确认删除</h3>
              <button className={styles['modal-close']} onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className={styles['modal-body']}>
              <p className={styles['confirm-message']}>
                确定要删除岗位「{selectedRequirement.name}」吗？此操作不可撤销。
              </p>
            </div>
            <div className={styles['modal-footer']}>
              <button className={styles['btn-cancel-modal']} onClick={() => setShowDeleteConfirm(false)}>
                取消
              </button>
              <button className={styles['btn-danger']} onClick={handleDelete} disabled={saving}>
                {saving ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {message && (
        <div className={styles.toast}>
          <span className={styles['toast-icon']}>
            {message.type === 'success' ? '✓' : '!'}
          </span>
          {message.text}
        </div>
      )}
    </div>
  );
}

export { JobRequirementPage };
