'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera, Images, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import ImageInput from '@/components/admin/ImageInput';

interface GalleryItem {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  status: string;
  photoCount: number;
  createdAt?: string;
}

interface PhotoRow {
  url: string;
  title: string;
  width: string;
  height: string;
}

const emptyForm = {
  title: '',
  slug: '',
  description: '',
  coverImage: '',
  status: 'PUBLISHED',
  photos: [] as PhotoRow[],
};

const inputClass =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function GalleryPage() {
  return (
    <ToastProvider>
      <GalleryContent />
    </ToastProvider>
  );
}

function GalleryContent() {
  const toast = useToast();
  const [list, setList] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      setList(data.list ?? []);
    } catch {
      toast('加载相册列表失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  async function openEdit(item: GalleryItem) {
    setEditing(item);
    setForm({
      title: item.title,
      slug: item.slug,
      description: item.description ?? '',
      coverImage: item.coverImage ?? '',
      status: item.status,
      photos: [],
    });
    setModalOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/gallery/${item.id}`);
      const data = await res.json();
      setForm({
        title: data.title ?? item.title,
        slug: data.slug ?? item.slug,
        description: data.description ?? '',
        coverImage: data.coverImage ?? '',
        status: data.status ?? item.status,
        photos: (data.photos ?? []).map((p: { url: string; title?: string | null; width?: number | null; height?: number | null }) => ({
          url: p.url ?? '',
          title: p.title ?? '',
          width: p.width != null ? String(p.width) : '',
          height: p.height != null ? String(p.height) : '',
        })),
      });
    } catch {
      toast('加载照片列表失败', 'error');
    }
    setDetailLoading(false);
  }

  function updatePhoto(index: number, patch: Partial<PhotoRow>) {
    setForm((f) => ({
      ...f,
      photos: f.photos.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }

  async function handleSave() {
    if (saving) return;
    if (!form.title.trim() || !form.slug.trim()) {
      toast('请填写标题与 slug', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title,
        slug: form.slug,
        description: form.description,
        coverImage: form.coverImage,
        status: form.status,
        photos: form.photos
          .filter((p) => p.url.trim())
          .map((p) => ({
            url: p.url,
            title: p.title || undefined,
            width: p.width ? Number(p.width) : undefined,
            height: p.height ? Number(p.height) : undefined,
          })),
      };
      const res = await fetch(editing ? `/api/gallery/${editing.id}` : '/api/gallery', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(editing ? '相册已更新' : '相册已创建');
      setModalOpen(false);
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
      const res = await fetch(`/api/gallery/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      toast('相册已删除');
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
      <div className="flex flex-wrap items-center justify-between gap-3 anim-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold">相册管理</h1>
          <p className="mt-1 text-sm text-fg-muted">整理站点相册与照片</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          新建相册
        </button>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-line bg-bg p-3">
              <div className="skeleton aspect-video w-full" />
              <div className="skeleton mt-3 h-4 w-2/3" />
              <div className="skeleton mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="anim-fade-in rounded-lg border border-dashed border-line px-6 py-16 text-center text-fg-muted">
          <Camera className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm">还没有相册 点击右上角新建</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {list.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-lg border border-line bg-bg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link href={`/console/gallery/${encodeURIComponent(item.slug)}/edit`} className="block overflow-hidden bg-bg-secondary">
                {item.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    className="aspect-video w-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-bg-secondary transition-colors duration-300 group-hover:bg-primary/5">
                    <Images className="h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
                  </div>
                )}
              </Link>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-semibold">{item.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600' : 'bg-bg-secondary text-fg-muted'
                    }`}
                  >
                    {item.status === 'PUBLISHED' ? '已发布' : '隐藏'}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs text-fg-muted">{item.description || '暂无描述'}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                    <Images className="h-3.5 w-3.5" />
                    {item.photoCount} 张照片
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Link
                      href={`/console/gallery/${encodeURIComponent(item.slug)}/edit`}
                      title="管理照片"
                      className="rounded p-1.5 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                    >
                      <Images className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      title="编辑信息"
                      onClick={() => openEdit(item)}
                      className="rounded p-1.5 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="删除相册"
                      onClick={() => setDeleteTarget(item)}
                      className="rounded p-1.5 text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新建/编辑模态 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '编辑相册' : '新建相册'}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">标题 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="相册标题"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="album-slug"
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="相册简介"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">封面图</label>
            <ImageInput value={form.coverImage} onChange={(v) => setForm((f) => ({ ...f, coverImage: v }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">状态</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="PUBLISHED">已发布</option>
              <option value="HIDDEN">隐藏</option>
            </select>
          </div>

          {/* 照片管理 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-fg-muted">照片（{form.photos.length}）</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, photos: [...f.photos, { url: '', title: '', width: '', height: '' }] }))}
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                添加照片
              </button>
            </div>
            {detailLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            ) : form.photos.length === 0 ? (
              <p className="rounded border border-dashed border-line px-4 py-4 text-center text-xs text-fg-muted">
                暂无照片 点击上方按钮添加
              </p>
            ) : (
              <div className="space-y-2 stagger">
                {form.photos.map((photo, i) => (
                  <div key={i} className="rounded border border-line bg-bg-secondary/50 p-3">
                    <ImageInput value={photo.url} onChange={(v) => updatePhoto(i, { url: v })} placeholder="图片 URL 或上传" />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={photo.title}
                        onChange={(e) => updatePhoto(i, { title: e.target.value })}
                        placeholder="照片标题"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        value={photo.width}
                        onChange={(e) => updatePhoto(i, { width: e.target.value })}
                        placeholder="宽度"
                        className={inputClass}
                      />
                      <div className="relative">
                        <input
                          type="number"
                          value={photo.height}
                          onChange={(e) => updatePhoto(i, { height: e.target.value })}
                          placeholder="高度"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          title="删除此照片"
                          onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                          className="absolute -right-2.5 -top-2.5 rounded-full bg-red-500 p-1 text-white shadow transition-all duration-200 hover:bg-red-600 active:scale-90"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        message={`确定删除相册「${deleteTarget?.title ?? ''}」吗？相册内的照片记录将一并删除`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
