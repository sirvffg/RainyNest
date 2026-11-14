// app/console/categories/page.tsx — 分类管理：左侧表单（新建/编辑共用）+ 右侧列表

'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Inbox, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { api, pickList, slugify } from '@/components/admin/utils';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

const INPUT_CLS =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-blue-500/20';

export default function CategoriesPage() {
  const [list, setList] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<unknown>('/api/categories');
      setList(pickList<CategoryItem>(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 未手动改过 slug 时根据名称自动生成
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setSlugTouched(false);
    setError('');
  }

  function startEdit(c: CategoryItem) {
    setEditingId(c.id);
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description ?? '');
    setSlugTouched(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError('请输入分类名称');
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim(),
    };
    try {
      if (editingId) {
        await api(`/api/categories/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/categories', { method: 'POST', body: JSON.stringify(body) });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败 请重试');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmTarget || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/api/categories/${confirmTarget.id}`, { method: 'DELETE' });
      setConfirmTarget(null);
      if (editingId === confirmTarget.id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-5">
      <div className="anim-fade-in-up">
        <h1 className="text-2xl font-bold">分类管理</h1>
        <p className="mt-1 text-sm text-fg-muted">组织文章内容结构</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* 表单 */}
        <form
          onSubmit={handleSubmit}
          className="anim-fade-in-up space-y-4 self-start rounded-lg border border-line bg-bg p-5"
          style={{ animationDelay: '0.05s' }}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FolderOpen className="h-4 w-4 text-primary" />
            {editingId ? '编辑分类' : '新建分类'}
          </h2>

          {error && (
            <div className="anim-fade-in rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 前端开发" className={INPUT_CLS} />
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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="分类的简要说明 可选"
              className={`${INPUT_CLS} resize-y`}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="liquid-btn liquid-btn-sm inline-flex flex-1 items-center justify-center gap-1.5 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? '保存修改' : '新建分类'}
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
            <h2 className="text-base font-semibold">全部分类</h2>
            <span className="text-xs text-fg-muted">{list.length} 个</span>
          </div>
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-fg-muted">
              <Inbox className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <p className="mt-2 text-xs">还没有分类 从左侧表单开始创建</p>
            </div>
          ) : (
            <ul className="stagger divide-y divide-line">
              {list.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors duration-200 hover:bg-bg-secondary/70 ${
                    editingId === c.id ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="truncate font-mono text-xs text-fg-muted">/{c.slug}</span>
                    </div>
                    {c.description && <p className="mt-0.5 truncate text-xs text-fg-muted">{c.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(c)}
                      title="编辑"
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmTarget(c)}
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
        title="删除分类"
        message={confirmTarget ? `确定删除分类「${confirmTarget.name}」吗 该分类下文章将变为未分类` : ''}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
