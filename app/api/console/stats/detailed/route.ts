// app/api/console/stats/detailed/route.ts — 详细统计（PV 趋势 / 热门文章 / 来源）
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { analytics } from '@/lib/analytics';

export const runtime = 'nodejs';

const DAYS = 30;

function fmtDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET() {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const since = new Date(Date.now() - (DAYS - 1) * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  // PV 趋势：近 30 天 pageView 按 date 聚合（uv 按 sessionId 去重），失败兜底空数组
  let pvTrend: { date: string; pv: number; uv: number }[] = [];
  try {
    const rows = await analytics.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, sessionId: true },
    });
    const map = new Map<string, { pv: number; sessions: Set<string> }>();
    // 预填 30 天，缺数据的天补 0
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      map.set(fmtDate(d), { pv: 0, sessions: new Set() });
    }
    for (const row of rows) {
      const key = fmtDate(row.createdAt);
      const bucket = map.get(key);
      if (!bucket) continue;
      bucket.pv += 1;
      if (row.sessionId) bucket.sessions.add(row.sessionId);
    }
    pvTrend = [...map.entries()].map(([date, v]) => ({ date, pv: v.pv, uv: v.sessions.size }));
  } catch (err) {
    console.error('[api/console/stats/detailed] pvTrend failed:', err);
    pvTrend = [];
  }

  // 热门文章（主库按 views）
  const topPosts = await db.post.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, title: true, slug: true, views: true },
    orderBy: { views: 'desc' },
    take: 5,
  });

  // 来源 top5（按 referer 分组），失败兜底空数组
  let sources: { referer: string; count: number }[] = [];
  try {
    const grouped = await analytics.pageView.groupBy({
      by: ['referer'],
      where: { createdAt: { gte: since }, referer: { not: null, notIn: [''] } },
      _count: { _all: true },
      orderBy: { _count: { referer: 'desc' } },
      take: 5,
    });
    sources = grouped.map((g) => ({ referer: g.referer || '', count: g._count._all }));
  } catch (err) {
    console.error('[api/console/stats/detailed] sources failed:', err);
    sources = [];
  }

  // 路径浏览排行（全时段 top20，原 page-views 插件能力合并于此）
  let topPaths: { path: string; count: number; lastViewedAt: string | null }[] = [];
  let totalPvAllTime = 0;
  try {
    totalPvAllTime = await analytics.pageView.count();
    const grouped = await analytics.pageView.groupBy({
      by: ['path'],
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { path: 'desc' } },
      take: 20,
    });
    topPaths = grouped.map((g) => ({
      path: g.path,
      count: g._count._all,
      lastViewedAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
    }));
  } catch (err) {
    console.error('[api/console/stats/detailed] topPaths failed:', err);
    topPaths = [];
  }

  return NextResponse.json({ pvTrend, topPosts, sources, topPaths, totalPvAllTime });
}
