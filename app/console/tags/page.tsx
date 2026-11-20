// app/console/tags/page.tsx — 标签管理：左侧表单（新建/编辑共用）+ 右侧列表

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Inbox, Loader2, Pencil, Plus, Save, Tags as TagsIcon, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import Modal from '@/components/admin/Modal';
import { api, pickList, slugify } from '@/components/admin/utils';

interface TagItem {
  id: string;
  name: string;
  slug: string;
}

const INPUT_CLS =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-blue-500/20';

export default function TagsPage() {
  const [list, setList] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<TagItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 合并标签
  const [mergeSource, setMergeSource] = useState<TagItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<unknown>('/api/tags');
      setList(pickList<TagItem>(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setSlug('');
    setSlugTouched(false);
    setError('');
  }

  function startEdit(t: TagItem) {
    setEditingId(t.id);
    setName(t.name);
    setSlug(t.slug);
    setSlugTouched(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入标签名称');
      return;
    }
    setSaving(true);
    setError('');
    const body = { name: name.trim(), slug: slug.trim() || slugify(name) };
    try {
      if (editingId) {
        await api(`/api/tags/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/tags', { method: 'POST', body: JSON.stringify(body) });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败 请重试');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/api/tags/${confirmTarget.id}`, { method: 'DELETE' });
      setConfirmTarget(null);
      if (editingId === confirmTarget.id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
    setDeleting(false);
  }

  function openMerge(tag: TagItem) {
    setMergeSource(tag);
    setMergeTargetId('');
    setError('');
  }

  async function handleMerge() {
    if (!mergeSource || !mergeTargetId || merging) return;
    setMerging(true);
    setError('');
    try {
      const result = await api<{ moved?: number; target?: string }>('/api/tags/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId: mergeSource.id, targetId: mergeTargetId }),
      });
      setNotice(`已合并「${mergeSource.name}」到「${result.target ?? ''}」，迁移 ${result.moved ?? 0} 篇文章关联`);
      if (editingId === mergeSource.id) resetForm();
      setMergeSource(null);
      setMergeTargetId('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '合并失败');
    }
    setMerging(false);
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div className="anim-fade-in rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* 表单 */}
        <form
          onSubmit={handleSubmit}
          className="anim-fade-in-up space-y-4 self-start rounded-lg border border-line bg-bg p-5"
          style={{ animationDelay: '0.05s' }}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <TagsIcon className="h-4 w-4 text-primary" />
            {editingId ? '编辑标签' : '新建标签'}
          </h2>

          {error && (
            <div className="anim-fade-in rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 React" className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">别名 slug</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="自动根据名称生成"
              className={`${INPUT_CLS} font-mono`}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="liquid-btn liquid-btn-sm inline-flex flex-1 items-center justify-center gap-1.5 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? '保存修改' : '新建标签'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95"
              >
                取消
              </button>
            )}
          </div>
        </form>

        {/* 列表 */}
        <div
          className="anim-fade-in-up overflow-hidden rounded-lg border border-line bg-bg"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-base font-semibold">全部标签</h2>
            <span className="text-xs text-fg-muted">{list.length} 个</span>
          </div>
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-fg-muted">
              <Inbox className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <p className="mt-2 text-xs">还没有标签 从左侧表单开始创建</p>
            </div>
          ) : (
            <ul className="stagger divide-y divide-line">
              {list.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center gap-4 px-5 py-3 transition-colors duration-200 hover:bg-bg-secondary/70 ${
                    editingId === t.id ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 font-mono text-xs text-fg-muted">/{t.slug}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(t)}
                      title="编辑"
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openMerge(t)}
                      title="合并到其他标签"
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmTarget(t)}
                      title="删除"
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除标签"
        message={confirmTarget ? `确定删除标签「${confirmTarget.name}」吗 与文章的关联将被移除` : ''}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* 合并标签 */}
      <Modal
        open={!!mergeSource}
        onClose={merging ? () => {} : () => setMergeSource(null)}
        title="合并标签"
        maxWidth="max-w-sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMergeSource(null)}
              disabled={merging}
              className="rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleMerge}
              disabled={merging || !mergeTargetId}
              className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              合并
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">
            将标签「{mergeSource?.name}」下的文章关联迁移到目标标签，然后删除该标签。
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">合并到</label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className={`${INPUT_CLS} cursor-pointer`}
            >
              <option value="">请选择目标标签</option>
              {list
                .filter((t) => t.id !== mergeSource?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（/{t.slug}）
                  </option>
                ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
