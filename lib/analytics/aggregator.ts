// lib/analytics/aggregator.ts — 定时聚合逻辑（cron 触发，纯函数）
// ① 回填主库 Post.views ② 更新 HourlyStat ③ 每日全量聚合 + 清理原始日志
// ⭐ 采用水位线增量聚合：每次只处理上次未聚合过的新 PageView，高频执行不会重复计数
import { db } from '../prisma';
import { analytics } from '../analytics';

// 水位线：上次聚合处理到的时间点（进程内；重启时从原始日志最大 createdAt 恢复，保证不重不漏）
const g = globalThis as unknown as { __rnPvCheckpoint?: Date };

export async function runMinuteAggregation() {
  const now = new Date();

  // 恢复/初始化水位线
  let since = g.__rnPvCheckpoint;
  if (!since) {
    const last = await analytics.pageView.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    since = last?.createdAt ?? now;
  }

  // ① 增量回填主库 Post.views（只算 (since, now] 的新日志）
  let minutePv = 0;
  if (since < now) {
    const pvStats = await analytics.pageView.groupBy({
      by: ['postId'],
      where: { postId: { not: null }, createdAt: { gt: since, lte: now } },
      _count: { postId: true },
    });

    for (const stat of pvStats) {
      if (!stat.postId) continue;
      try {
        await db.post.update({
          where: { id: stat.postId },
          data: { views: { increment: stat._count.postId } },
        });
      } catch { /* 文章已删除，跳过 */ }
    }

    minutePv = await analytics.pageView.count({
      where: { createdAt: { gt: since, lte: now } },
    });

    // ② 更新当前小时的 HourlyStat：pv 增量累加，uv 每次重算当小时去重数（避免 UV 越滚越大）
    const hourKey = new Date(now);
    hourKey.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourKey.getTime() + 60 * 60 * 1000);
    const hourSessions = await analytics.pageView.groupBy({
      by: ['sessionId'],
      where: { createdAt: { gte: hourKey, lt: hourEnd }, sessionId: { not: null } },
      _count: { sessionId: true },
    });

    await analytics.hourlyStat.upsert({
      where: { hour: hourKey },
      update: { pv: { increment: minutePv }, uv: hourSessions.length },
      create: { hour: hourKey, pv: minutePv, uv: hourSessions.length },
    });
  }

  // 推进水位线
  g.__rnPvCheckpoint = now;

  // ③ 每天首个整分钟触发一次 DailyStat 全量聚合 + 清理老数据
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    await runDailyAggregation();
  }
}

export async function runDailyAggregation() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = new Date(yesterday);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const where = { createdAt: { gte: dayStart, lt: dayEnd } };

  const pv = await analytics.pageView.count({ where });
  const sessions = await analytics.pageView.groupBy({
    by: ['sessionId'],
    where,
    _count: { sessionId: true },
  });

  // 热门路径
  const topPaths = await analytics.pageView.groupBy({
    by: ['path'],
    where,
    _count: { path: true },
    orderBy: { _count: { path: 'desc' } },
    take: 1,
  });

  // 热门文章
  const topPosts = await analytics.pageView.groupBy({
    by: ['postId'],
    where: { ...where, postId: { not: null } },
    _count: { postId: true },
    orderBy: { _count: { postId: 'desc' } },
    take: 1,
  });

  // 设备分布（按 UA 简易判断）
  const uas = await analytics.pageView.groupBy({
    by: ['userAgent'],
    where,
    _count: { userAgent: true },
  });
  const devices = { mobile: 0, desktop: 0, tablet: 0 };
  for (const ua of uas) {
    const s = (ua.userAgent || '').toLowerCase();
    if (s.includes('ipad') || s.includes('tablet')) devices.tablet += ua._count.userAgent;
    else if (/mobile|android|iphone/.test(s)) devices.mobile += ua._count.userAgent;
    else devices.desktop += ua._count.userAgent;
  }

  // PostDailyView 明细
  const postViews = await analytics.pageView.groupBy({
    by: ['postId'],
    where: { ...where, postId: { not: null } },
    _count: { postId: true },
  });
  for (const item of postViews) {
    if (!item.postId) continue;
    await analytics.postDailyView.upsert({
      where: { postId_date: { postId: item.postId, date: dayStart } },
      update: { pv: item._count.postId },
      create: { postId: item.postId, date: dayStart, pv: item._count.postId },
    });
  }

  await analytics.dailyStat.upsert({
    where: { date: dayStart },
    update: {
      pv,
      uv: sessions.length,
      topPath: topPaths[0]?.path ?? null,
      topPathPv: topPaths[0]?._count.path ?? 0,
      topPostId: topPosts[0]?.postId ?? null,
      topPostPv: topPosts[0]?._count.postId ?? 0,
      devices: JSON.stringify(devices),
    },
    create: {
      date: dayStart,
      pv,
      uv: sessions.length,
      topPath: topPaths[0]?.path ?? null,
      topPathPv: topPaths[0]?._count.path ?? 0,
      topPostId: topPosts[0]?.postId ?? null,
      topPostPv: topPosts[0]?._count.postId ?? 0,
      devices: JSON.stringify(devices),
    },
  });

  // 清理 30 天前的原始 PageView（保留聚合表）
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  await analytics.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } });

  console.log(`[Analytics] Daily aggregation done: ${pv} PV, ${sessions.length} UV (${dayStart.toISOString().slice(0, 10)})`);
}
