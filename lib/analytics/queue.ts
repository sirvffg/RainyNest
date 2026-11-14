// lib/analytics/queue.ts — 进程内 PV 队列 + 批量写入 Worker
// 访问统计完全不阻塞前台：API route 入队后立即 return，SQLite 写入由本模块异步批量完成
import { analytics } from '../analytics';
import { db } from '../prisma';

interface PendingPV {
  path: string;
  postSlug: string | null;
  sessionId: string;
  ip: string;
  userAgent: string;
  referer: string;
  createdAt: Date;
}

// ⭐ 进程级单例队列
const g = globalThis as unknown as {
  __rnPvQueue?: PendingPV[];
  __rnPvFlushTimer?: ReturnType<typeof setTimeout> | null;
};

const queue = g.__rnPvQueue ?? (g.__rnPvQueue = []);
let flushTimer = g.__rnPvFlushTimer ?? (g.__rnPvFlushTimer = null);

const FLUSH_INTERVAL_MS = 100;
const FLUSH_BATCH_SIZE = 50;
const MAX_QUEUE_SIZE = 10000;

// 入队（API route 调这个，同步返回）
export function enqueuePageView(pv: PendingPV) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  queue.push(pv);

  if (queue.length >= FLUSH_BATCH_SIZE) {
    scheduleFlush(0);
  } else if (!flushTimer) {
    scheduleFlush(FLUSH_INTERVAL_MS);
  }
}

function scheduleFlush(delay: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, delay);
}

// slug → postId 映射（主库读取，内存缓存）
const slugCache = new Map<string, string>();
async function getPostIdBySlug(slug: string): Promise<string | null> {
  if (slugCache.has(slug)) return slugCache.get(slug)!;
  try {
    const post = await db.post.findUnique({ where: { slug }, select: { id: true } });
    if (post) {
      slugCache.set(slug, post.id);
      return post.id;
    }
  } catch { /* 主库不可用 */ }
  return null;
}

async function flush() {
  flushTimer = null;
  const batch = queue.splice(0, queue.length);
  if (batch.length === 0) return;

  const startedAt = Date.now();

  try {
    // ① 批量写入 PageView
    const withPostIds = await Promise.all(
      batch.map(async (pv) => ({
        path: pv.path.slice(0, 500),
        postId: pv.postSlug ? await getPostIdBySlug(pv.postSlug) : null,
        sessionId: pv.sessionId || null,
        ip: pv.ip,
        userAgent: (pv.userAgent || '').slice(0, 500),
        referer: (pv.referer || '').slice(0, 500),
        createdAt: pv.createdAt,
      }))
    );

    await analytics.pageView.createMany({ data: withPostIds });

    // ② 批量 upsert OnlineVisitor（按 sessionId 去重，减少事务大小）
    const sessionIds = [...new Set(batch.map((pv) => pv.sessionId).filter(Boolean))];
    const lastBySession = new Map<string, PendingPV>();
    for (const pv of batch) {
      if (pv.sessionId) lastBySession.set(pv.sessionId, pv);
    }

    await analytics.$transaction(
      [...lastBySession.values()].map((pv) =>
        analytics.onlineVisitor.upsert({
          where: { sessionId: pv.sessionId },
          update: { lastSeen: pv.createdAt, path: pv.path },
          create: {
            sessionId: pv.sessionId,
            ip: pv.ip,
            path: pv.path,
            userAgent: (pv.userAgent || '').slice(0, 500),
            lastSeen: pv.createdAt,
          },
        })
      )
    );

    console.log(
      `[Analytics] ✓ Flushed ${batch.length} PV (${Date.now() - startedAt}ms, ${sessionIds.length} sessions)`
    );
  } catch (err) {
    console.error(`[Analytics] ✗ Flush failed (${batch.length} items):`, err);
    // 失败批次放回队列头部，给下一次 flush 机会
    queue.unshift(...batch);
  }
}

// 立即 flush（测试/退出时用）
export async function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
}

// ⭐ 进程退出前 flush 一次（防止丢数据）
if (process.env.NODE_ENV === 'production') {
  const shutdown = async () => {
    if (queue.length > 0) {
      console.log(`[Analytics] Shutdown: flushing ${queue.length} remaining PV...`);
      try { await flushNow(); } catch { /* ignore */ }
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
