// app/console/page.tsx — 后台仪表盘：统计卡片 + 最近评论 + 热门文章

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  FileText,
  HardDriveDownload,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import StatCard from '@/components/admin/StatCard';
import OnlineNow from '@/components/admin/OnlineNow';
import { api, timeAgo } from '@/components/admin/utils';

interface RecentComment {
  id: string;
  content: string;
  createdAt: string;
  user?: { displayName?: string };
  post?: { title?: string };
}

interface TopPost {
  title: string;
  views: number;
  slug: string;
}

interface ConsoleStats {
  posts: number;
  publishedPosts: number;
  comments: number;
  pendingComments: number;
  views: number;
  online: number;
  recentComments?: RecentComment[];
  topPosts?: TopPost[];
}

// 插件扩展点：dashboardWidget（服务端渲染好的 HTML 卡片）
interface PluginWidget {
  slug: string;
  title: string;
  icon?: string;
  colSpan: number;
  html: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ConsoleStats | null>(null);
  const [widgets, setWidgets] = useState<PluginWidget[]>([]);
  const [quickActions, setQuickActions] = useState<{ label: string; href: string; icon?: string }[]>([]);
  const [error, setError] = useState('');
  const [backingUp, setBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  // 立即创建一次完整备份
  const manualBackup = useCallback(async () => {
    if (backingUp) return;
    setBackingUp(true);
    setBackupMsg('');
    try {
      const res = await fetch('/api/console/backup', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `备份失败 (${res.status})`);
      setBackupMsg(`备份完成：${data?.backup?.name ?? ''}`);
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : '备份失败');
    }
    setBackingUp(false);
    window.setTimeout(() => setBackupMsg(''), 4000);
  }, [backingUp]);

  const load = useCallback(async () => {
    setError('');
    try {
      setStats(await api<ConsoleStats>('/api/console/stats'));
      // 插件小部件失败不影响主统计
      try {
        const data = await api<{
          widgets?: PluginWidget[];
          quickActions?: { label: string; href: string; icon?: string }[];
        }>('/api/console/plugin-widgets');
        setWidgets(Array.isArray(data?.widgets) ? data.widgets : []);
        setQuickActions(Array.isArray(data?.quickActions) ? data.quickActions : []);
      } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = stats
    ? [
        { icon: FileText, label: '文章总数', value: stats.posts, hint: `已发布 ${stats.publishedPosts}` },
        { icon: MessageSquare, label: '评论总数', value: stats.comments, hint: `待审 ${stats.pendingComments}` },
        { icon: Eye, label: '总浏览量', value: stats.views, hint: '累计访问' },
        { icon: Users, label: '当前在线', value: stats.online, hint: '实时访客' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="anim-fade-in flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span className="flex-1">{error}</span>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-xs transition-all duration-200 hover:bg-red-100 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="stagger grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats
          ? cards.map((c) => <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} hint={c.hint} />)
          : [0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-line bg-bg p-5">
                <div className="skeleton h-4 w-20" />
                <div className="skeleton mt-4 h-8 w-16" />
                <div className="skeleton mt-3 h-3 w-24" />
              </div>
            ))}
      </div>

      {/* 实时在线 + 运维快捷操作 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OnlineNow />
        </div>
        <div className="anim-fade-in-up flex flex-col justify-between gap-3 rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div>
            <h3 className="text-sm font-semibold">运维快捷操作</h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              手动创建一次站点完整备份（主库 / 统计库 / 插件数据）
            </p>
          </div>
          <button
            type="button"
            onClick={manualBackup}
            disabled={backingUp}
            className="inline-flex items-center justify-center gap-2 rounded border border-line px-4 py-2 text-sm font-medium transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4" />}
            {backingUp ? '备份中' : '立即备份'}
          </button>
          {backupMsg && <p className="text-xs text-emerald-600">{backupMsg}</p>}
          {quickActions.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {quickActions.map((a) => (
                <a
                  key={a.href + a.label}
                  href={a.href}
                  className="rounded border border-line px-2.5 py-1 text-xs text-fg-muted transition-all duration-200 hover:border-primary hover:text-primary"
                >
                  {a.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 插件小部件（dashboardWidget 扩展点，服务端渲染 HTML） */}
      {widgets.length > 0 && (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {widgets.map((w) => (
            <div
              key={w.slug + w.title}
              title={`插件 ${w.slug}`}
              className="anim-fade-in-up rounded-lg border border-line bg-bg p-5"
              style={{ gridColumn: w.colSpan > 1 ? `span ${Math.min(w.colSpan, 4)} / span ${Math.min(w.colSpan, 4)}` : undefined }}
              dangerouslySetInnerHTML={{ __html: w.html }}
            />
          ))}
        </div>
      )}

      {/* 最近评论 + 热门文章 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="anim-fade-in-up rounded-lg border border-line bg-bg" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">最近评论</h2>
            {stats && stats.pendingComments > 0 && (
              <span className="anim-scale-in ml-auto inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                待审 {stats.pendingComments}
              </span>
            )}
          </div>
          <div className="p-2.5">
            {stats ? (
              (stats.recentComments ?? []).length > 0 ? (
                <div className="stagger space-y-0.5">
                  {stats.recentComments!.map((c) => (
                    <div
                      key={c.id}
                      className="flex gap-3 rounded px-2.5 py-2.5 transition-colors duration-200 hover:bg-bg-secondary"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-medium text-blue-600">
                        {(c.user?.displayName ?? '匿').slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm leading-relaxed">{c.content}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                          <span className="font-medium text-fg">{c.user?.displayName ?? '匿名用户'}</span>
                          <span>评论于</span>
                          <span className="truncate">《{c.post?.title ?? '未知文章'}》</span>
                          <span className="ml-auto shrink-0">{timeAgo(c.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-fg-muted">
                  <Inbox className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
                  <p className="mt-2 text-xs">还没有收到评论</p>
                </div>
              )
            ) : (
              <div className="space-y-3 p-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-12 w-full" />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="anim-fade-in-up rounded-lg border border-line bg-bg" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">热门文章</h2>
          </div>
          <div className="p-2.5">
            {stats ? (
              (stats.topPosts ?? []).length > 0 ? (
                <div className="stagger space-y-0.5">
                  {stats.topPosts!.map((p, i) => (
                    <div
                      key={`${p.slug}-${i}`}
                      className="flex items-center gap-3 rounded px-2.5 py-2.5 transition-colors duration-200 hover:bg-bg-secondary"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                          i < 3 ? 'bg-blue-50 text-blue-600' : 'bg-bg-secondary text-fg-muted'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-muted">
                        <Eye className="h-3.5 w-3.5" />
                        {p.views.toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-fg-muted">
                  <FileText className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
                  <p className="mt-2 text-xs">暂无浏览数据</p>
                </div>
              )
            ) : (
              <div className="space-y-3 p-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-9 w-full" />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
