// components/admin/PostEditor.tsx — 文章编辑器（新建/编辑共用 支持预览与封面上传）

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  Inbox,
  Loader2,
  Pencil,
  Upload,
  X,
} from 'lucide-react';
import { api, pickList, slugify } from '@/components/admin/utils';
import MilkdownEditor from '@/components/admin/MilkdownEditor';

export interface PostEditorInitial {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImage: string;
  status: string;
  isTop: boolean;
  allowComment: boolean;
  categoryId: string | null;
  tags: string[];
}

interface CategoryItem {
  id: string;
  name: string;
}

const INPUT_CLS =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-blue-500/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</label>
      {children}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 active:scale-95 ${
        checked ? 'bg-primary' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function PostEditor({
  mode,
  postId,
  initial,
}: {
  mode: 'create' | 'edit';
  postId?: string;
  initial?: PostEditorInitial | null;
}) {
  const router = useRouter();
  const notFound = mode === 'edit' && !initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'DRAFT');
  const [isTop, setIsTop] = useState(initial?.isTop ?? false);
  const [allowComment, setAllowComment] = useState(initial?.allowComment ?? true);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 未手动改过 slug 时根据标题自动生成
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  // 加载分类下拉
  useEffect(() => {
    api('/api/categories')
      .then((d) => setCategories(pickList<CategoryItem>(d)))
      .catch(() => {});
  }, []);

  function commitTags(raw: string) {
    const parts = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    setTagInput('');
    if (parts.length) setTags((prev) => Array.from(new Set([...prev, ...parts])));
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTags(tagInput);
    } else if (e.key === 'Backspace' && !tagInput) {
      setTags((prev) => prev.slice(0, -1));
    }
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
      if (res.ok && data?.url) setCoverImage(data.url);
      else setError(data?.message || '图片上传失败 请重试');
    } catch {
      setError('图片上传失败 请重试');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function togglePreview() {
    if (previewLoading) return;
    if (preview) {
      setPreview(false);
      return;
    }
    if (!content.trim()) {
      setError('暂无正文内容可预览');
      return;
    }
    setPreviewLoading(true);
    setError('');
    try {
      const data = await api<{ html: string }>('/api/posts/preview', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setPreviewHtml(data.html ?? '');
      setPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览失败');
    }
    setPreviewLoading(false);
  }

  async function handleSave() {
    if (saving) return;
    if (!title.trim()) {
      setError('请输入文章标题');
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      summary: summary.trim(),
      content,
      coverImage: coverImage.trim(),
      status,
      isTop,
      allowComment,
      categoryId: categoryId || null,
      tags,
    };
    try {
      if (mode === 'create') {
        await api('/api/posts', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await api(`/api/posts/${postId}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      router.push('/console/posts');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败 请重试');
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="anim-fade-in-up rounded-lg border border-line bg-bg p-12 text-center">
        <Inbox className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-fg-muted">文章不存在或加载失败</p>
        <Link
          href="/console/posts"
          className="liquid-btn liquid-btn-sm mt-4 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          返回文章列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 顶部操作栏 */}
      <div className="anim-fade-in-down flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/console/posts"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-all duration-200 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePreview}
            disabled={previewLoading}
            className="inline-flex items-center gap-1.5 rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : preview ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {preview ? '继续编辑' : '预览'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存{status === 'PUBLISHED' ? '并发布' : '草稿'}
          </button>
        </div>
      </div>

      {error && (
        <div className="anim-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      {/* 标题 */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="输入文章标题"
        className="anim-fade-in-up w-full rounded-lg border border-line bg-bg px-4 py-3 text-xl font-bold outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400 focus:border-primary"
        style={{ animationDelay: '0.05s' }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 正文 / 预览 */}
        <div className="anim-fade-in-up min-w-0" style={{ animationDelay: '0.1s' }}>
          {preview ? (
            <div className="anim-fade-in rounded-lg border border-line bg-bg p-6">
              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-bg transition-colors duration-200 focus-within:border-primary">
              <MilkdownEditor value={content} onChange={setContent} />
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-fg-muted">
                <span>Markdown 可视化编辑</span>
                <span>约 {content.length} 字</span>
              </div>
            </div>
          )}
        </div>

        {/* 侧栏设置 */}
        <aside className="anim-fade-in-up space-y-4" style={{ animationDelay: '0.15s' }}>
          <section className="space-y-4 rounded-lg border border-line bg-bg p-4">
            <Field label="别名 slug">
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="自动根据标题生成"
                className={`${INPUT_CLS} font-mono`}
              />
            </Field>
            <Field label="分类">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={INPUT_CLS}>
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="标签">
              <div className="rounded border border-line bg-bg p-2 transition-colors duration-200 focus-within:border-primary">
                {tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="anim-scale-in inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                          aria-label={`移除标签 ${t}`}
                          className="transition-transform duration-200 hover:scale-125 active:scale-90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={onTagKeyDown}
                  onBlur={() => commitTags(tagInput)}
                  placeholder="输入后回车 逗号分隔多个"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </Field>
          </section>

          <section className="space-y-4 rounded-lg border border-line bg-bg p-4">
            <Field label="封面图片">
              <div className="flex gap-2">
                <input
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="图片 URL 或上传"
                  className={INPUT_CLS}
                />
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  上传
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
              </div>
              {coverImage && (
                <div className="anim-scale-in relative mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImage} alt="封面预览" className="h-28 w-full rounded border border-line object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    aria-label="移除封面"
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-transform duration-200 hover:scale-110 active:scale-90"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </Field>
            <Field label="摘要">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="显示在列表页的简介"
                className={`${INPUT_CLS} resize-y`}
              />
            </Field>
          </section>

          <section className="space-y-3 rounded-lg border border-line bg-bg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">开启评论</span>
              <Switch checked={allowComment} onChange={setAllowComment} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">置顶文章</span>
              <Switch checked={isTop} onChange={setIsTop} />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-fg-muted">发布状态</span>
              <div className="flex rounded border border-line p-0.5">
                {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded px-3 py-1 text-xs transition-all duration-200 active:scale-95 ${
                      status === s ? 'bg-primary text-white' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {s === 'DRAFT' ? '草稿' : '发布'}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
