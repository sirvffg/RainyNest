// app/console/attachments/page.tsx — 附件库：搜索 / 网格预览 / 复制 URL / 删除
'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileQuestion, Image as ImageIcon, Loader2, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import CopyButton from '@/components/markdown/CopyButton';
import { api, formatDate } from '@/components/admin/utils';

interface AttachmentItem {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number;
  storage: string;
  createdAt: string;
  uploader?: { displayName: string; username: string } | null;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

export default function AttachmentsPage() {
  const [list, setList] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<AttachmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pluginTabs, setPluginTabs] = useState<{ pluginSlug: string; key: string; label: string; html: string }[]>([]);
  const [pluginTab, setPluginTab] = useState('');
  const [pluginOps, setPluginOps] = useState<{ label: string; hrefTemplate: string }[]>([]);

  const load = useCallback(async (targetPage: number, search: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(targetPage), size: '24' });
      if (search) params.set('q', search);
      const data = await api<{
        list: AttachmentItem[];
        total: number;
        pages: number;
        tabs?: { pluginSlug: string; key: string; label: string; html: string }[];
        operations?: { label: string; hrefTemplate: string }[];
      }>(`/api/console/attachments?${params.toString()}`);
      setList(data.list ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages || 1);
      setPluginTabs(Array.isArray(data.tabs) ? data.tabs : []);
      setPluginOps(Array.isArray(data.operations) ? data.operations : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载附件失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(page, keyword);
  }, [load, page, keyword]);

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api(`/api/console/attachments?id=${encodeURIComponent(confirmTarget.id)}`, {
        method: 'DELETE',
      });
      setConfirmTarget(null);
      // 删除后若当前页已空则回退一页
      if (list.length === 1 && page > 1) setPage((p) => p - 1);
      else await load(page, keyword);
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-5">
      {/* 标题 / 搜索 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">附件库</h1>
          <p className="mt-1 text-sm text-fg-muted">共 {total} 个附件（存储于 /uploads 或插件存储）</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setKeyword(q.trim());
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索文件名 / URL"
              className="w-56 rounded border border-line bg-bg py-2 pl-8 pr-3 text-sm outline-none transition-all duration-200 placeholder:text-fg-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button type="submit" className="liquid-btn liquid-btn-sm">
            搜索
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 附件选择器扩展 Tab（attachmentSelectorTab） */}
      {pluginTabs.length > 0 && (
        <div className="rounded-lg border border-line bg-bg p-4 anim-fade-in">
          <div className="mb-2 flex flex-wrap gap-1 border-b border-line pb-2">
            {pluginTabs.map((t) => (
              <button
                key={`${t.pluginSlug}:${t.key}`}
                type="button"
                onClick={() => setPluginTab(t.key)}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  (pluginTab || pluginTabs[0]?.key) === t.key ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-bg-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="text-sm" dangerouslySetInnerHTML={{ __html: (pluginTabs.find((t) => t.key === pluginTab) ?? pluginTabs[0])?.html ?? '' }} />
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-fg-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-16 text-fg-muted">
          <ImageIcon className="h-8 w-8 opacity-50" />
          <span className="text-sm">暂无附件</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((item) => (
            <div
              key={item.id}
              className="anim-fade-in group overflow-hidden rounded-lg border border-line bg-bg transition-all duration-300 hover:shadow-md hover:border-primary/40"
            >
              <div className="aspect-square overflow-hidden bg-bg-secondary">
                {isImage(item.mimeType) ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-fg-muted/50">
                    <FileQuestion className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-xs font-medium" title={item.name}>
                  {item.name}
                </p>
                <p className="text-[11px] text-fg-muted">
                  {formatSize(item.size)} · {formatDate(item.createdAt)}
                </p>
                <div className="flex items-center justify-between pt-0.5">
                  <CopyButton
                    text={item.url}
                    label="URL"
                    className="text-fg-muted hover:bg-bg-secondary hover:text-primary"
                  />
                  {pluginOps.map((op) => (
                    <a
                      key={op.label}
                      href={op.hrefTemplate.replace('{id}', item.id).replace('{url}', encodeURIComponent(item.url))}
                      className="rounded px-1.5 py-0.5 text-[11px] text-fg-muted transition-colors hover:bg-bg-secondary hover:text-primary"
                    >
                      {op.label}
                    </a>
                  ))}
                  <button
                    onClick={() => setConfirmTarget(item)}
                    title="删除附件"
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-line px-3 py-1.5 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm text-fg-muted">
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="rounded border border-line px-3 py-1.5 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除附件"
        message={confirmTarget ? `确定删除「${confirmTarget.name}」吗？本地文件也会一并移除。` : ''}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
