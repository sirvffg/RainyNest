'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Globe, Link2, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import { ConfirmDialog } from '@/components/admin/Modal';
import ImageInput from '@/components/admin/ImageInput';
import Toggle from '@/components/admin/Toggle';

interface LinkItem {
  id: string;
  name: string;
  url: string;
  logo?: string | null;
  description?: string | null;
  category?: string | null;
  order: number;
  status: string;
}

interface LinkForm {
  name: string;
  url: string;
  logo: string;
  description: string;
  category: string;
  order: string;
  published: boolean;
}

const emptyForm: LinkForm = {
  name: '',
  url: '',
  logo: '',
  description: '',
  category: '',
  order: '0',
  published: true,
};

const inputClass =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function LinksPage() {
  return (
    <ToastProvider>
      <LinksContent />
    </ToastProvider>
  );
}

function LinksContent() {
  const toast = useToast();
  const [list, setList] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LinkForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LinkItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/links');
      const data = await res.json();
      const items: LinkItem[] = data.list ?? [];
      setList(items.sort((a, b) => a.order - b.order));
    } catch {
      toast('加载友链列表失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(item: LinkItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      url: item.url,
      logo: item.logo ?? '',
      description: item.description ?? '',
      category: item.category ?? '',
      order: String(item.order ?? 0),
      published: item.status === 'PUBLISHED',
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.url.trim()) {
      toast('请填写名称与链接地址', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        url: form.url,
        logo: form.logo || undefined,
        description: form.description || undefined,
        category: form.category || undefined,
        order: form.order ? Number(form.order) : 0,
        status: form.published ? 'PUBLISHED' : 'HIDDEN',
      };
      const res = await fetch(editingId ? `/api/links/${editingId}` : '/api/links', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(editingId ? '友链已更新' : '友链已添加');
      resetForm();
      load();
    } catch {
      toast('保存失败 请稍后重试', 'error');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/links/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      toast('友链已删除');
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      load();
    } catch {
      toast('删除失败 请稍后重试', 'error');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="anim-fade-in-up">
        <h1 className="text-2xl font-bold">友链管理</h1>
        <p className="mt-1 text-sm text-fg-muted">维护站点友邻 静候光临</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* 左侧表单 */}
        <form
          onSubmit={handleSave}
          className="h-fit space-y-4 rounded-lg border border-line bg-bg p-4 sm:p-5 anim-fade-in-up lg:sticky lg:top-20"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4 text-primary" />
              {editingId ? '编辑友链' : '新建友链'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted transition-all duration-200 hover:text-fg active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
                取消编辑
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="站点名称"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">链接 *</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">站点图标</label>
            <ImageInput value={form.logo} onChange={(v) => setForm((f) => ({ ...f, logo: v }))} placeholder="Logo URL 或上传" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="一句话介绍"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">分类</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="如 博客"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">排序</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded border border-line px-3.5 py-2.5 transition-all duration-200 hover:border-primary/40">
            <span className="text-sm">
              {form.published ? '已发布' : '已隐藏'}
              <span className="ml-1.5 text-xs text-fg-muted">是否展示在前台</span>
            </span>
            <Toggle checked={form.published} onChange={(v) => setForm((f) => ({ ...f, published: v }))} label="发布状态" />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="liquid-btn liquid-btn-sm inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? '保存中' : editingId ? '保存修改' : '添加友链'}
          </button>
        </form>

        {/* 右侧列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-24 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="anim-fade-in rounded-lg border border-dashed border-line px-6 py-16 text-center text-fg-muted">
              <Globe className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
              <p className="mt-3 text-sm">还没有友链 在左侧表单添加第一个吧</p>
            </div>
          ) : (
            <div className="space-y-3 stagger">
              {list.map((item) => (
                <div
                  key={item.id}
                  className={`group flex flex-wrap items-center gap-3 rounded-lg border bg-bg p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-nowrap ${
                    editingId === item.id ? 'border-primary/60 ring-1 ring-primary/20' : 'border-line'
                  }`}
                >
                  {item.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.logo} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-secondary">
                      <Globe className="h-5 w-5 text-fg-muted" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium transition-colors duration-200 hover:text-primary"
                      >
                        {item.name}
                        <ExternalLink className="h-3 w-3 text-fg-muted" />
                      </a>
                      {item.category && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{item.category}</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">{item.description || item.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-fg-muted">
                    <span className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">#{item.order}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        item.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600' : 'bg-bg-secondary text-fg-muted'
                      }`}
                    >
                      {item.status === 'PUBLISHED' ? '已发布' : '已隐藏'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      title="编辑"
                      onClick={() => openEdit(item)}
                      className="rounded p-2 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      onClick={() => setDeleteTarget(item)}
                      className="rounded p-2 text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        message={`确定删除友链「${deleteTarget?.name ?? ''}」吗？`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
