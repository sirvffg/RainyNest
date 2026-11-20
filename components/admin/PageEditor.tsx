// components/admin/PageEditor.tsx — 独立页面编辑器（新建/编辑共用）

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Inbox, Loader2, Save } from 'lucide-react';
import { api, slugify } from '@/components/admin/utils';
import MilkdownEditor from '@/components/admin/MilkdownEditor';

export interface PageEditorInitial {
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: string;
  order: number;
  showSidebar?: boolean;
  sidebarContent?: string | null;
}

const INPUT_CLS =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-blue-500/20';

export default function PageEditor({
  mode,
  pageId,
  initial,
}: {
  mode: 'create' | 'edit';
  pageId?: string;
  initial?: PageEditorInitial | null;
}) {
  const router = useRouter();
  const notFound = mode === 'edit' && !initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'PUBLISHED');
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [showSidebar, setShowSidebar] = useState(initial?.showSidebar ?? true);
  const [sidebarContent, setSidebarContent] = useState(initial?.sidebarContent ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const slugRef = useRef(slugTouched);
  slugRef.current = slugTouched;

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  async function handleSave() {
    if (saving) return;
    if (!title.trim()) {
      setError('请输入页面标题');
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      summary: summary.trim(),
      content,
      status,
      order,
      showSidebar,
      sidebarContent: sidebarContent.trim() || null,
    };
    try {
      if (mode === 'create') {
        await api('/api/pages', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await api(`/api/pages/${pageId}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      router.push('/console/pages');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败 请重试');
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="anim-fade-in-up rounded-lg border border-line bg-bg p-12 text-center">
        <Inbox className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-fg-muted">页面不存在或加载失败</p>
        <Link
          href="/console/pages"
          className="liquid-btn liquid-btn-sm mt-4 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          返回页面列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="anim-fade-in-down flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/console/pages"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-all duration-200 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存页面
        </button>
      </div>

      {error && (
        <div className="anim-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="输入页面标题"
        className="anim-fade-in-up w-full rounded-lg border border-line bg-bg px-4 py-3 text-xl font-bold outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400 focus:border-primary"
        style={{ animationDelay: '0.05s' }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="anim-fade-in-up min-w-0" style={{ animationDelay: '0.1s' }}>
          <div className="rounded-lg border border-line bg-bg transition-colors duration-200 focus-within:border-primary">
            <MilkdownEditor value={content} onChange={setContent} />
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-fg-muted">
              <span>Markdown 可视化编辑</span>
              <span>约 {content.length} 字</span>
            </div>
          </div>
        </div>

        <aside className="anim-fade-in-up space-y-4" style={{ animationDelay: '0.15s' }}>
          <section className="space-y-4 rounded-lg border border-line bg-bg p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">别名 slug</label>
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="自动根据标题生成"
                className={`${INPUT_CLS} font-mono`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">摘要</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="页面的简要说明 可选"
                className={`${INPUT_CLS} resize-y`}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-line bg-bg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">发布状态</span>
              <div className="flex rounded border border-line p-0.5">
                {(['PUBLISHED', 'DRAFT'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded px-3 py-1 text-xs transition-all duration-200 active:scale-95 ${
                      status === s ? 'bg-primary text-white' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {s === 'PUBLISHED' ? '发布' : '草稿'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">排序权重</span>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value) || 0)}
                className="w-20 rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none transition-all duration-200 focus:border-primary"
              />
            </div>
          </section>

          {/* 独立页面侧边栏控制 */}
          <section className="space-y-3 rounded-lg border border-line bg-bg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">显示侧边栏</span>
              <button
                type="button"
                role="switch"
                aria-checked={showSidebar}
                onClick={() => setShowSidebar((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 active:scale-95 ${
                  showSidebar ? 'bg-primary' : 'bg-bg-secondary border border-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                    showSidebar ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            {showSidebar && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-fg-muted">
                  自定义侧边栏内容（Markdown，留空使用默认侧栏）
                </label>
                <textarea
                  value={sidebarContent}
                  onChange={(e) => setSidebarContent(e.target.value)}
                  rows={5}
                  placeholder="例如：关于本站、联系方式等"
                  className={`${INPUT_CLS} resize-y font-mono text-xs`}
                />
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
