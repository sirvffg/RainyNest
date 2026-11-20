// components/comment/CommentForm.tsx — 评论表单（客户端：登录检测 + 提交）
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogIn, Loader2, Send, MessageSquareDashed } from 'lucide-react';
import type { CommentFieldDef } from '@/lib/plugin/types';

const FIELD_CLS =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 placeholder:text-fg-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20';

function initExtra(fields: CommentFieldDef[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const f of fields) init[f.key] = f.defaultValue ?? '';
  return init;
}

export default function CommentForm({
  postId,
  fields = [],
}: {
  postId: string;
  /** 插件 injectCommentField 注入的结构化字段 */
  fields?: CommentFieldDef[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = 检测中
  const [content, setContent] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>(() => initExtra(fields));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 会话检测（NextAuth session 端点，兼容静态渲染页面）
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setLoggedIn(!!data?.user);
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || loading) return;

    // 插件字段必填校验
    for (const field of fields) {
      if (field.required && !String(extra[field.key] ?? '').trim()) {
        setError(`请填写「${field.label}」`);
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { postId, content: text };
      if (fields.length > 0) payload.extra = extra;

      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        setContent('');
        setExtra(initExtra(fields));
        router.refresh(); // 刷新服务端评论列表
      } else if (res.status === 401) {
        setLoggedIn(false);
        setError('登录状态已失效 请重新登录');
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.message || '提交失败 请稍后再试');
      }
    } catch {
      setError('网络异常 请稍后再试');
    } finally {
      setLoading(false);
    }
  }

  // 会话检测中
  if (loggedIn === null) {
    return (
      <div className="rounded-lg border border-line p-5 anim-fade-in">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-3 h-20 w-full" />
      </div>
    );
  }

  // 未登录
  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-8 text-center anim-fade-in">
        <LogIn className="w-6 h-6 text-fg-muted" />
        <p className="text-sm text-fg-muted">登录后可评论</p>
        <Link
          href={`/signin?redirect=${encodeURIComponent(pathname)}`}
          className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-95"
        >
          <LogIn className="w-4 h-4" />
          去登录
        </Link>
      </div>
    );
  }

  // 已登录
  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-bg p-4 transition-shadow duration-300 focus-within:shadow-md anim-fade-in">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的评论..."
        rows={4}
        maxLength={2000}
        className="w-full resize-y rounded border border-line bg-bg px-3 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-fg-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      {/* 插件扩展字段 */}
      {fields.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-xs text-fg-muted">
                {field.label}
                {field.required && <span className="ml-0.5 text-red-500">*</span>}
              </span>
              {field.type === 'textarea' ? (
                <textarea
                  value={extra[field.key] ?? ''}
                  onChange={(e) => setExtra((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={2}
                  className={`${FIELD_CLS} resize-y`}
                />
              ) : field.type === 'select' ? (
                <select
                  value={extra[field.key] ?? ''}
                  onChange={(e) => setExtra((v) => ({ ...v, [field.key]: e.target.value }))}
                  className={`${FIELD_CLS} cursor-pointer`}
                >
                  <option value="">请选择</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                  value={extra[field.key] ?? ''}
                  onChange={(e) => setExtra((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={FIELD_CLS}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-fg-muted">{error || `${content.length} / 2000`}</p>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="inline-flex shrink-0 items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {loading ? '提交中' : '发表评论'}
        </button>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-500 anim-fade-in">
          <MessageSquareDashed className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </form>
  );
}
