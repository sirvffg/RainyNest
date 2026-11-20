// app/console/posts/page.tsx — 文章管理列表：搜索/筛选/分页/置顶/删除

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  Inbox,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Puzzle,
  Search,
  Trash2,
} from 'lucide-react';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { api, formatDate } from '@/components/admin/utils';

interface PostItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  isTop: boolean;
  views: number;
  createdAt: string;
  publishedAt: string | null;
  category: { name: string; slug: string } | null;
  tags: { name: string }[];
  /** 插件 postListItemField 渲染结果 */
  _fields?: Record<string, string>;
}

// 插件扩展点：postListItemOperation（链接型操作按钮，onClick 字段为 href 模板）
interface PluginOperation {
  slug: string;
  label: string;
  icon?: string;
  variant: 'default' | 'ghost' | 'outline';
  hrefTemplate: string;
}

function opHref(tpl: string, post: PostItem): string {
  return tpl.replace('{id}', post.id).replace('{slug}', post.slug);
}

type PostFull = Partial<PostItem> & {
  content?: string;
  summary?: string | null;
  coverImage?: string | null;
  allowComment?: boolean;
  categoryId?: string | null;
  tags?: { name?: string }[];
};

const PAGE_SIZE = 10;

const ICON_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-bg-secondary active:scale-90 disabled:cursor-not-allowed disabled:opacity-60';
const ICON_BTN_PRIMARY = `${ICON_BTN} hover:text-primary`;
const ICON_BTN_DANGER = `${ICON_BTN} hover:bg-red-50 hover:text-red-500`;

export default function PostsPage() {
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<PostItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PostItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [operations, setOperations] = useState<PluginOperation[]>([]);
  const [fields, setFields] = useState<{ key: string; label: string; width?: number }[]>([]);
  const [error, setError] = useState('');

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(input);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [input]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (keyword) params.set('keyword', keyword);
      if (status) params.set('status', status);
      const data = await api<{
        list?: PostItem[];
        total?: number;
        operations?: PluginOperation[];
        fields?: { key: string; label: string; width?: number }[];
      }>(`/api/posts?${params}`);
      setList(Array.isArray(data?.list) ? data.list : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
      setOperations(Array.isArray(data?.operations) ? data.operations : []);
      setFields(Array.isArray(data?.fields) ? data.fields : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setList([]);
    }
    setLoading(false);
  }, [keyword, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleTop(post: PostItem) {
    if (toggling) return;
    setToggling(post.id);
    setError('');
    try {
      // 拉取完整数据后合并置顶状态 保证 PUT 契约字段完整
      let full: PostFull | null = null;
      try {
        full = await api<PostFull>(`/api/posts/${post.id}`);
      } catch {
        full = null;
      }
      const body = full
        ? {
            title: full.title,
            slug: full.slug,
            summary: full.summary ?? '',
            content: full.content ?? '',
            coverImage: full.coverImage ?? '',
            status: full.status,
            isTop: !post.isTop,
            allowComment: full.allowComment ?? true,
            categoryId: full.categoryId ?? null,
            tags: Array.isArray(full.tags)
              ? full.tags.map((t) => t?.name ?? '').filter(Boolean)
              : [],
          }
        : { isTop: !post.isTop };
      await api(`/api/posts/${post.id}`, { method: 'PUT', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    }
    setToggling(null);
  }

  async function handleDelete() {
    if (!confirmTarget || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/api/posts/${confirmTarget.id}`, { method: 'DELETE' });
      setConfirmTarget(null);
      if (list.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
    setDeleting(false);
  }

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="anim-fade-in-up flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/console/posts/new"
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          新建文章
        </Link>
      </div>

      {/* 筛选栏 */}
      <div className="anim-fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: '0.05s' }}>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="搜索标题或别名"
            className="w-full rounded border border-line bg-bg py-2 pl-9 pr-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary"
        >
          <option value="">全部状态</option>
          <option value="PUBLISHED">已发布</option>
          <option value="DRAFT">草稿</option>
        </select>
      </div>

      {error && (
        <div className="anim-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="anim-fade-in-up rounded-lg border border-dashed border-line bg-bg p-12 text-center">
          <Inbox className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-fg-muted">
            {keyword || status ? '没有符合条件的文章' : '还没有文章 点击下方开始创作'}
          </p>
          <Link
            href="/console/posts/new"
            className="liquid-btn liquid-btn-sm mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            新建文章
          </Link>
        </div>
      ) : (
        <>
          {/* 桌面端表格 */}
          <div
            className="anim-fade-in-up hidden overflow-hidden rounded-lg border border-line bg-bg md:block"
            style={{ animationDelay: '0.1s' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-bg-secondary text-left text-xs text-fg-muted">
                  <th className="px-4 py-3 font-medium">标题</th>
                  <th className="px-4 py-3 font-medium">分类 / 标签</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">浏览</th>
                  <th className="px-4 py-3 font-medium">发布时间</th>
                  {fields.map((f) => (
                    <th key={f.key} className="px-4 py-3 font-medium" style={f.width ? { width: f.width } : undefined}>
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="stagger divide-y divide-line">
                {list.map((post) => (
                  <tr key={post.id} className="transition-colors duration-200 hover:bg-bg-secondary/70">
                    <td className="max-w-[280px] px-4 py-3">
                      <Link
                        href={`/console/posts/${post.id}/edit`}
                        className="flex items-center gap-1.5 font-medium transition-colors duration-200 hover:text-primary"
                      >
                        {post.isTop && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        <span className="truncate">{post.title}</span>
                      </Link>
                      <div className="mt-0.5 truncate font-mono text-xs text-fg-muted">/{post.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {post.category ? (
                          post.category.name
                        ) : (
                          <span className="text-fg-muted">未分类</span>
                        )}
                      </div>
                      {post.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {post.tags.slice(0, 3).map((t, ti) => (
                            <span
                              key={`${typeof t === 'string' ? t : t?.name}-${ti}`}
                              className="rounded border border-line bg-bg-secondary px-1.5 py-0.5 text-[11px] text-fg-muted"
                            >
                              {typeof t === 'string' ? t : t?.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-fg-muted">
                        <Eye className="h-3.5 w-3.5" />
                        {post.views.toLocaleString('zh-CN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted">{formatDate(post.publishedAt ?? post.createdAt)}</td>
                    {fields.map((f) => (
                      <td key={f.key} className="px-4 py-3 text-xs text-fg-muted">
                        {post._fields?.[f.key] || '-'}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/console/posts/${post.id}/edit`} title="编辑" className={ICON_BTN_PRIMARY}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => toggleTop(post)}
                          disabled={toggling === post.id}
                          title={post.isTop ? '取消置顶' : '设为置顶'}
                          className={ICON_BTN_PRIMARY}
                        >
                          {toggling === post.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : post.isTop ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmTarget(post)}
                          title="删除"
                          className={ICON_BTN_DANGER}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {operations.map((op) => (
                          <Link
                            key={op.slug + op.label}
                            href={opHref(op.hrefTemplate, post)}
                            title={`${op.label}（插件 ${op.slug}）`}
                            className={ICON_BTN_PRIMARY}
                          >
                            <Puzzle className="h-4 w-4" />
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片 */}
          <div className="stagger space-y-3 md:hidden">
            {list.map((post) => (
              <div key={post.id} className="rounded-lg border border-line bg-bg p-4 transition-shadow duration-200 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/console/posts/${post.id}/edit`}
                    className="flex min-w-0 items-center gap-1.5 font-medium transition-colors duration-200 hover:text-primary"
                  >
                    {post.isTop && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <span className="truncate">{post.title}</span>
                  </Link>
                  <StatusBadge status={post.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                  <span>{post.category?.name ?? '未分类'}</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {post.views.toLocaleString('zh-CN')}
                  </span>
                  <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
                </div>
                {post.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {post.tags.map((t, ti) => (
                      <span key={`${typeof t === 'string' ? t : t?.name}-${ti}`} className="rounded border border-line bg-bg-secondary px-1.5 py-0.5 text-[11px]">
                        {typeof t === 'string' ? t : t?.name}
                      </span>
                    ))}
                  </div>
                )}
                {fields.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
                    {fields.map((f) => (
                      <span key={f.key}>
                        {f.label}：{post._fields?.[f.key] || '-'}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <Link
                    href={`/console/posts/${post.id}/edit`}
                    className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Link>
                  {operations.map((op) => (
                    <Link
                      key={op.slug + op.label}
                      href={opHref(op.hrefTemplate, post)}
                      className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                    >
                      <Puzzle className="h-3.5 w-3.5" />
                      {op.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => toggleTop(post)}
                    disabled={toggling === post.id}
                    className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:opacity-60"
                  >
                    {toggling === post.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" />
                    )}
                    {post.isTop ? '取消置顶' : '置顶'}
                  </button>
                  <button
                    onClick={() => setConfirmTarget(post)}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-all duration-200 hover:bg-red-50 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          <div className="anim-fade-in flex items-center justify-between text-sm text-fg-muted">
            <span>
              第 {page} / {maxPage} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-line px-3 py-1.5 transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                disabled={page >= maxPage || list.length < PAGE_SIZE}
                className="rounded border border-line px-3 py-1.5 transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除文章"
        message={confirmTarget ? `确定删除文章「${confirmTarget.title}」吗 删除后无法恢复` : ''}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
