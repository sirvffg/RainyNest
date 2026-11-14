'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, Images, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import ImageInput from '@/components/admin/ImageInput';

interface GalleryDetail {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  status: string;
  photos: PhotoRow[];
}

interface PhotoRow {
  url: string;
  title: string;
  width: string;
  height: string;
}

const inputClass =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function GalleryPhotoEditor({ slug }: { slug: string }) {
  return (
    <ToastProvider>
      <Editor slug={slug} />
    </ToastProvider>
  );
}

function Editor({ slug }: { slug: string }) {
  const toast = useToast();
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      const item = (data.list ?? []).find((g: { slug: string }) => g.slug === slug);
      if (!item) {
        setNotFound(true);
        return;
      }
      const detail = await (await fetch(`/api/gallery/${item.id}`)).json();
      setGallery({
        id: item.id,
        title: detail.title ?? '',
        slug: detail.slug ?? slug,
        description: detail.description ?? '',
        coverImage: detail.coverImage ?? '',
        status: detail.status ?? 'PUBLISHED',
        photos: [],
      });
      setPhotos(
        (detail.photos ?? []).map((p: { url?: string; title?: string | null; width?: number | null; height?: number | null }) => ({
          url: p.url ?? '',
          title: p.title ?? '',
          width: p.width != null ? String(p.width) : '',
          height: p.height != null ? String(p.height) : '',
        }))
      );
    } catch {
      toast('加载相册失败', 'error');
    }
    setLoading(false);
  }, [slug, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function updatePhoto(index: number, patch: Partial<PhotoRow>) {
    setPhotos((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleSave() {
    if (saving || !gallery) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/gallery/${gallery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: gallery.title,
          slug: gallery.slug,
          description: gallery.description,
          coverImage: gallery.coverImage,
          status: gallery.status,
          photos: photos
            .filter((p) => p.url.trim())
            .map((p) => ({
              url: p.url,
              title: p.title || undefined,
              width: p.width ? Number(p.width) : undefined,
              height: p.height ? Number(p.height) : undefined,
            })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast('照片已保存');
    } catch {
      toast('保存失败 请稍后重试', 'error');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }

  if (notFound || !gallery) {
    return (
      <div className="anim-fade-in rounded-lg border border-dashed border-line px-6 py-16 text-center text-fg-muted">
        <Camera className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
        <p className="mt-3 text-sm">未找到该相册</p>
        <Link
          href="/console/gallery"
          className="mt-4 inline-flex items-center gap-1.5 rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          返回相册列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3 anim-fade-in-up">
        <div className="flex items-center gap-3">
          <Link
            href="/console/gallery"
            title="返回相册列表"
            className="rounded p-2 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-fg active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{gallery.title}</h1>
            <p className="mt-0.5 text-sm text-fg-muted">编辑相册照片 共 {photos.length} 张</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-2 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中' : '保存修改'}
        </button>
      </div>

      {/* 照片列表 */}
      <div className="rounded-lg border border-line bg-bg p-4 sm:p-5 anim-fade-in-up" style={{ animationDelay: '0.05s' }}>
        {photos.length === 0 ? (
          <p className="rounded border border-dashed border-line px-4 py-10 text-center text-sm text-fg-muted">
            暂无照片 点击下方按钮添加
          </p>
        ) : (
          <div className="space-y-3 stagger">
            {photos.map((photo, i) => (
              <div key={i} className="group rounded border border-line bg-bg-secondary/40 p-3.5 transition-all duration-300 hover:border-primary/40">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={photo.title || `照片 ${i + 1}`}
                      className="h-12 w-20 shrink-0 rounded border border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-dashed border-line">
                      <Images className="h-4 w-4 text-fg-muted/40" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <ImageInput value={photo.url} onChange={(v) => updatePhoto(i, { url: v })} placeholder="图片 URL 或上传" />
                  </div>
                  <button
                    type="button"
                    title="删除此照片"
                    onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                    className="shrink-0 rounded p-2 text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 sm:pl-16">
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
                    placeholder="宽度 px"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={photo.height}
                    onChange={(e) => updatePhoto(i, { height: e.target.value })}
                    placeholder="高度 px"
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPhotos((list) => [...list, { url: '', title: '', width: '', height: '' }])}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded border border-dashed border-line py-3 text-sm text-fg-muted transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          添加照片
        </button>
      </div>
    </div>
  );
}
