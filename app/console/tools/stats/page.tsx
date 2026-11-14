'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Eye, FileText, TrendingUp } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';

interface TrendPoint {
  date: string;
  pv: number;
  uv: number;
}

interface TopPost {
  title: string;
  slug: string;
  views: number;
}

interface SourceItem {
  source: string;
  count: number;
}

interface DetailedStats {
  pvTrend: TrendPoint[];
  topPosts: TopPost[];
  sources: SourceItem[];
}

export default function StatsPage() {
  return (
    <ToastProvider>
      <StatsContent />
    </ToastProvider>
  );
}

function StatsContent() {
  const toast = useToast();
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/console/stats/detailed');
      const data = await res.json();
      setStats(data ?? {});
    } catch {
      toast('加载统计数据失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPv = useMemo(() => (stats?.pvTrend ?? []).reduce((sum, d) => sum + (d.pv || 0), 0), [stats]);
  const totalUv = useMemo(() => (stats?.pvTrend ?? []).reduce((sum, d) => sum + (d.uv || 0), 0), [stats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-80 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-80 w-full" />
          <div className="skeleton h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="anim-fade-in-up">
        <h1 className="text-2xl font-bold">访问统计</h1>
        <p className="mt-1 text-sm text-fg-muted">近 30 天流量趋势与热门内容</p>
      </div>

      <TrendChartSection data={stats?.pvTrend ?? []} totalPv={totalPv} totalUv={totalUv} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TopPostsSection posts={stats?.topPosts ?? []} />
        <SourcesSection sources={stats?.sources ?? []} />
      </div>
    </div>
  );
}

/* ═══════════ 折线图（纯 SVG） ═══════════ */

function TrendChartSection({ data, totalPv, totalUv }: { data: TrendPoint[]; totalPv: number; totalUv: number }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 800;
  const H = 280;
  const PL = 46;
  const PR = 14;
  const PT = 18;
  const PB = 32;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const max = useMemo(() => {
    const raw = Math.max(1, ...data.map((d) => Math.max(d.pv || 0, d.uv || 0)));
    const step = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw / step) * step;
  }, [data]);

  const x = (i: number) => (data.length <= 1 ? PL + innerW / 2 : PL + (i / (data.length - 1)) * innerW);
  const y = (v: number) => PT + innerH - (Math.max(0, v) / max) * innerH;

  const pvPoints = data.map((d, i) => `${x(i)},${y(d.pv || 0)}`).join(' ');
  const uvPoints = data.map((d, i) => `${x(i)},${y(d.uv || 0)}`).join(' ');
  const areaPath =
    data.length > 0
      ? `M ${x(0)},${y(data[0]?.pv || 0)} ${data
          .slice(1)
          .map((d, i) => `L ${x(i + 1)},${y(d.pv || 0)}`)
          .join(' ')} L ${x(data.length - 1)},${PT + innerH} L ${x(0)},${PT + innerH} Z`
      : '';

  const hovered = hover != null ? data[hover] : null;
  const gridValues = [max, max * 0.75, max * 0.5, max * 0.25, 0];

  if (data.length === 0) {
    return (
      <div className="anim-fade-in rounded-lg border border-dashed border-line px-6 py-16 text-center text-fg-muted">
        <TrendingUp className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
        <p className="mt-3 text-sm">暂无访问数据</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-bg p-4 sm:p-5 anim-fade-in-up" style={{ animationDelay: '0.05s' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-primary" />
          流量趋势
        </h2>
        <div className="flex items-center gap-4 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            PV 合计 {totalPv.toLocaleString('zh-CN')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-fg" />
            UV 合计 {totalUv.toLocaleString('zh-CN')}
          </span>
        </div>
      </div>

      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="近 30 天 PV UV 趋势图">
          <defs>
            <linearGradient id="pvArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* 网格与纵轴刻度 */}
          {gridValues.map((v, i) => {
            const gy = y(v);
            return (
              <g key={i}>
                <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="var(--color-border)" strokeWidth="1" strokeDasharray={v === 0 ? '0' : '3 4'} />
                <text x={PL - 8} y={gy + 3.5} textAnchor="end" fontSize="10" fill="var(--color-fg-muted)">
                  {v >= 10000 ? `${Math.round(v / 1000)}k` : v}
                </text>
              </g>
            );
          })}

          {/* PV 面积 */}
          <path d={areaPath} fill="url(#pvArea)" />

          {/* 折线 */}
          <polyline points={pvPoints} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={uvPoints} fill="none" stroke="var(--color-fg)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />

          {/* 数据点 */}
          {data.map((d, i) => (
            <circle key={`p-${i}`} cx={x(i)} cy={y(d.pv || 0)} r={hover === i ? 4.5 : 2.5} fill="var(--color-primary)" className="transition-all duration-150" />
          ))}
          {data.map((d, i) => (
            <circle key={`u-${i}`} cx={x(i)} cy={y(d.uv || 0)} r={hover === i ? 3.5 : 1.8} fill="var(--color-fg)" opacity="0.7" className="transition-all duration-150" />
          ))}

          {/* hover 高亮竖线 */}
          {hover != null && (
            <line x1={x(hover)} y1={PT} x2={x(hover)} y2={PT + innerH} stroke="var(--color-primary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          )}

          {/* 横轴日期 */}
          {data.map((d, i) => {
            const show = i % 7 === 0 || i === data.length - 1;
            if (!show) return null;
            return (
              <text key={`x-${i}`} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--color-fg-muted)">
                {String(d.date ?? '').slice(5)}
              </text>
            );
          })}

          {/* hover 交互区 */}
          {data.map((_, i) => {
            const half = data.length <= 1 ? innerW / 2 : innerW / data.length / 2;
            const x0 = i === 0 ? PL : x(i) - half;
            const x1 = i === data.length - 1 ? W - PR : x(i) + half;
            return (
              <rect
                key={`h-${i}`}
                x={x0}
                y={PT}
                width={Math.max(2, x1 - x0)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
                style={{ cursor: 'crosshair' }}
              />
            );
          })}
        </svg>

        {/* 悬浮提示 */}
        {hovered && hover != null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-bg px-3 py-2 text-xs shadow-lg anim-fade-in"
            style={{
              left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`,
              top: `${(y(hovered.pv || 0) / H) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            <p className="font-medium">{hovered.date}</p>
            <p className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              PV {Number(hovered.pv || 0).toLocaleString('zh-CN')}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-fg" />
              UV {Number(hovered.uv || 0).toLocaleString('zh-CN')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ 热门文章 ═══════════ */

function TopPostsSection({ posts }: { posts: TopPost[] }) {
  const maxViews = Math.max(1, ...posts.map((p) => p.views || 0));
  return (
    <div className="rounded-lg border border-line bg-bg p-4 sm:p-5 anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-primary" />
        热门文章 Top 10
      </h2>
      {posts.length === 0 ? (
        <p className="mt-6 rounded border border-dashed border-line px-4 py-8 text-center text-sm text-fg-muted">暂无文章访问数据</p>
      ) : (
        <ol className="mt-4 space-y-3 stagger">
          {posts.slice(0, 10).map((post, i) => (
            <li key={post.slug ?? i} className="group">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                    i < 3 ? 'bg-primary text-white' : 'bg-bg-secondary text-fg-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{post.title}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-muted">
                  <Eye className="h-3.5 w-3.5" />
                  {Number(post.views || 0).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-secondary" style={{ marginLeft: '2.125rem' }}>
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700 ease-smooth group-hover:opacity-80"
                  style={{ width: `${Math.max(3, ((post.views || 0) / maxViews) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ═══════════ 来源分布 ═══════════ */

function SourcesSection({ sources }: { sources: SourceItem[] }) {
  const total = sources.reduce((sum, s) => sum + (s.count || 0), 0) || 1;
  const maxCount = Math.max(1, ...sources.map((s) => s.count || 0));
  return (
    <div className="rounded-lg border border-line bg-bg p-4 sm:p-5 anim-fade-in-up" style={{ animationDelay: '0.15s' }}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="h-4 w-4 text-primary" />
        来源分布
      </h2>
      {sources.length === 0 ? (
        <p className="mt-6 rounded border border-dashed border-line px-4 py-8 text-center text-sm text-fg-muted">暂无来源数据</p>
      ) : (
        <div className="mt-4 space-y-3 stagger">
          {sources.map((s) => (
            <div key={s.source} className="group">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{s.source || '直接访问'}</span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {Number(s.count || 0).toLocaleString('zh-CN')} · {Math.round(((s.count || 0) / total) * 100)}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-700 ease-smooth group-hover:opacity-80"
                  style={{ width: `${Math.max(3, ((s.count || 0) / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
