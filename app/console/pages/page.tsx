// app/console/pages/page.tsx — 独立页面管理列表

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileStack, Inbox, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { api, formatDate, pickList } from '@/components/admin/utils';

interface PageItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  order: number;
  updatedAt?: string;
  /** 插件 pageListItemField 渲染结果 */
  _fields?: Record<string, string>;
}

export default function PagesListPage() {
  const [list, setList] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<PageItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<{ key: string; label: string; width?: number }[]>([]);
  const [operations, setOperations] = useState<{ slug: string; label: string; hrefTemplate: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{
        list?: PageItem[];
        fields?: { key: string; label: string; width?: number }[];
        operations?: { slug: string; label: string; hrefTemplate: string }[];
      }>('/api/pages');
      setList(pickList<PageItem>(data));
      setFields(Array.isArray(data?.fields) ? data.fields : []);
      setOperations(Array.isArray(data?.operations) ? data.operations : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setList([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/api/pages/${confirmTarget.id}`, { method: 'DELETE' });
      setConfirmTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-5">
      <div className="anim-fade-in-up flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/console/pages/new"
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          新建页面
        </Link>
      </div>

      {error && (
        <div className="anim-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="anim-fade-in-up rounded-lg border border-dashed border-line bg-bg p-12 text-center">
          <FileStack className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-fg-muted">还没有独立页面 点击下方开始创建</p>
          <Link
            href="/console/pages/new"
            className="liquid-btn liquid-btn-sm mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            新建页面
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
                  <th className="px-4 py-3 font-medium">别名</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">排序</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                  {fields.map((f) => (
                    <th key={f.key} className="px-4 py-3 font-medium" style={f.width ? { width: f.width } : undefined}>{f.label}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="stagger divide-y divide-line">
                {list.map((p) => (
                  <tr key={p.id} className="transition-colors duration-200 hover:bg-bg-secondary/70">
                    <td className="px-4 py-3">
                      <Link
                        href={`/console/pages/${p.id}/edit`}
                        className="font-medium transition-colors duration-200 hover:text-primary"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-muted">/{p.slug}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{p.order}</td>
                    <td className="px-4 py-3 text-xs text-fg-muted">{formatDate(p.updatedAt)}</td>
                    {fields.map((f) => (
                      <td key={f.key} className="px-4 py-3 text-xs text-fg-muted">{p._fields?.[f.key] || '-'}</td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/console/pages/${p.id}/edit`}
                          title="编辑"
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setConfirmTarget(p)}
                          title="删除"
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {operations.map((op) => (
                          <a
                            key={op.slug + op.label}
                            href={op.hrefTemplate.replace('{id}', p.id).replace('{slug}', p.slug)}
                            className="rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-secondary hover:text-primary"
                          >
                            {op.label}
                          </a>
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
            {list.map((p) => (
              <div key={p.id} className="rounded-lg border border-line bg-bg p-4 transition-shadow duration-200 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/console/pages/${p.id}/edit`}
                    className="min-w-0 truncate font-medium transition-colors duration-200 hover:text-primary"
                  >
                    {p.title}
                  </Link>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
                  <span className="font-mono">/{p.slug}</span>
                  <span>排序 {p.order}</span>
                  <span>{formatDate(p.updatedAt)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <Link
                    href={`/console/pages/${p.id}/edit`}
                    className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Link>
                  <button
                    onClick={() => setConfirmTarget(p)}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-all duration-200 hover:bg-red-50 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                  {operations.map((op) => (
                    <a
                      key={op.slug + op.label}
                      href={op.hrefTemplate.replace('{id}', p.id).replace('{slug}', p.slug)}
                      className="inline-flex items-center gap-1 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                    >
                      {op.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除页面"
        message={confirmTarget ? `确定删除页面「${confirmTarget.title}」吗 删除后无法恢复` : ''}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
