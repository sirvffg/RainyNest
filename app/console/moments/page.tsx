// app/console/moments/page.tsx — 说说管理：顶部发布框（含图片上传）+ 说说列表

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Images, Loader2, Plus, Send, Sparkles, Trash2, X } from 'lucide-react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { api, formatDate, pickList, timeAgo } from '@/components/admin/utils';

interface MomentItem {
  id: string;
  content: string;
  images: string[] | string | null;
  createdAt: string;
}

function parseImages(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw) {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((v) => typeof v === 'string' && v) : [];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

export default function MomentsPage() {
  const [list, setList] = useState<MomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<MomentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<unknown>('/api/moments');
      setList(pickList<MomentItem>(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addImage() {
    const url = imageInput.trim();
    if (!url) return;
    setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setImageInput('');
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data?.url) setImages((prev) => [...prev, data.url]);
      else setError(data?.message || '图片上传失败 请重试');
    } catch {
      setError('图片上传失败 请重试');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handlePublish() {
    if (publishing) return;
    if (!content.trim()) {
      setError('说点什么再发布吧');
      return;
    }
    setPublishing(true);
    setError('');
    try {
      await api('/api/moments', {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), images }),
      });
      setContent('');
      setImages([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败 请重试');
    }
    setPublishing(false);
  }

  async function handleDelete() {
    if (!confirmTarget || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/api/moments/${confirmTarget.id}`, { method: 'DELETE' });
      setConfirmTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-5">
      {/* 发布框 */}
      <div className="anim-fade-in-up rounded-lg border border-line bg-bg p-5" style={{ animationDelay: '0.05s' }}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          发布说说
        </h2>

        {error && (
          <div className="anim-fade-in mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="此刻的想法"
          className="mt-3 w-full resize-y rounded border border-line bg-bg px-3 py-2.5 text-sm leading-relaxed outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-blue-500/20"
        />

        {/* 图片列表 */}
        {images.length > 0 && (
          <div className="stagger mt-3 flex flex-wrap gap-2">
            {images.map((url) => (
              <div key={url} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="说说配图" className="h-16 w-16 rounded border border-line object-cover" />
                <button
                  onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                  aria-label="移除图片"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow transition-transform duration-200 hover:scale-110 active:scale-90"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={imageInput}
            onChange={(e) => setImageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addImage();
              }
            }}
            placeholder="图片 URL 回车添加"
            className="min-w-0 flex-1 rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={addImage}
            className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
          >
            <Plus className="h-4 w-4" />
            添加
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            上传
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            发布
          </button>
        </div>
      </div>

      {/* 说说列表 */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="anim-fade-in-up flex flex-col items-center rounded-lg border border-dashed border-line bg-bg py-16 text-fg-muted">
          <Images className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm">还没有说说 在上方发布第一条吧</p>
        </div>
      ) : (
        <div className="stagger space-y-3">
          {list.map((m) => {
            const imgs = parseImages(m.images);
            return (
              <div key={m.id} className="rounded-lg border border-line bg-bg p-4 transition-all duration-200 hover:shadow-sm">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</p>
                {imgs.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {imgs.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt="说说配图"
                        className="h-28 w-full rounded border border-line object-cover transition-transform duration-300 hover:scale-[1.02]"
                      />
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-xs text-fg-muted">
                  <span title={formatDate(m.createdAt)}>{timeAgo(m.createdAt)}</span>
                  <button
                    onClick={() => setConfirmTarget(m)}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-all duration-200 hover:bg-red-50 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除说说"
        message="确定删除这条说说吗 删除后无法恢复"
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
