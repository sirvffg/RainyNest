// app/console/comments/page.tsx — 评论管理：三态 Tab 切换 + 通过/拒绝/删除

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Loader2,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { api, timeAgo } from '@/components/admin/utils';

type CommentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface CommentItem {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  post?: { title?: string; slug?: string };
  user?: { displayName?: string };
}

const TABS: { key: CommentStatus; label: string; icon: typeof Clock }[] = [
  { key: 'PENDING', label: '待审核', icon: Clock },
  { key: 'APPROVED', label: '已通过', icon: CheckCircle2 },
  { key: 'REJECTED', label: '已拒绝', icon: XCircle },
];

const PAGE_SIZE = 10;

export default function CommentsPage() {
  const [status, setStatus] = useState<CommentStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CommentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ list?: CommentItem[]; total?: number }>(
        `/api/comments?status=${status}&page=${page}`
      );
      setList(Array.isArray(data?.list) ? data.list : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setList([]);
    }
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(c: CommentItem, next: 'APPROVED' | 'REJECTED') {
    setActing(c.id);
    setError('');
    try {
      await api(`/api/comments/${c.id}`, { method: 'PUT', body: JSON.stringify({ status: next }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    }
    setActing(null);
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/api/comments/${confirmTarget.id}`, { method: 'DELETE' });
      setConfirmTarget(null);
      if (list.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
    setDeleting(false);
  }

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const ACTION_BTN =
    'inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="space-y-5">
      <div className="anim-fade-in-up">
        <h1 className="text-2xl font-bold">评论管理</h1>
        <p className="mt-1 text-sm text-fg-muted">审核站点评论互动</p>
      </div>

      {/* Tab 切换 */}
      <div className="anim-fade-in-down flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition-all duration-200 active:scale-95 ${
              status === t.key
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
        <button
          onClick={load}
          title="刷新"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="anim-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="anim-fade-in flex flex-col items-center rounded-lg border border-dashed border-line bg-bg py-16 text-fg-muted">
          <Inbox className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm">这里暂时没有评论</p>
        </div>
      ) : (
        <>
          {/* key 切换触发 Tab 过渡动画 */}
          <div key={status} className="stagger space-y-3">
            {list.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-line bg-bg p-4 transition-all duration-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-medium text-blue-600">
                    {(c.user?.displayName ?? '匿').slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.user?.displayName ?? '匿名用户'}</div>
                    <div className="flex items-center gap-1 text-xs text-fg-muted">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.post?.title ?? '未知文章'}</span>
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-fg-muted sm:block">{timeAgo(c.createdAt)}</span>
                    <StatusBadge status={c.status} />
                  </div>
                </div>

                <p className="mt-2.5 break-words text-sm leading-relaxed">{c.content}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {c.status !== 'APPROVED' && (
                    <button
                      onClick={() => changeStatus(c, 'APPROVED')}
                      disabled={acting === c.id}
                      className={`${ACTION_BTN} border-blue-200 text-blue-600 hover:bg-blue-50`}
                    >
                      {acting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      通过
                    </button>
                  )}
                  {c.status !== 'REJECTED' && (
                    <button
                      onClick={() => changeStatus(c, 'REJECTED')}
                      disabled={acting === c.id}
                      className={`${ACTION_BTN} border-amber-200 text-amber-600 hover:bg-amber-50`}
                    >
                      <X className="h-3.5 w-3.5" />
                      拒绝
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmTarget(c)}
                    className={`${ACTION_BTN} ml-auto border-red-200 text-red-500 hover:bg-red-50`}
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
              共 {total.toLocaleString('zh-CN')} 条 · 第 {page} / {maxPage} 页
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
        title="删除评论"
        message={confirmTarget ? '确定删除这条评论吗 删除后无法恢复' : ''}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
