// app/api/analytics/online/route.ts — 实时在线人数（SSE）
// 每 5 秒推送最近 5 分钟内的去重会话数；单连接最长 30 分钟
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { analytics } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 5 * 60 * 1000;
const INTERVAL_MS = 5 * 1000;
const MAX_DURATION_MS = 30 * 60 * 1000;

// 统计窗口内去重 sessionId；数据库异常返回 null（连接保持，不发数据）
async function countOnline(): Promise<number | null> {
  try {
    const rows = await analytics.pageView.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
        sessionId: { not: null },
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    return rows.filter((r) => r.sessionId).length;
  } catch (err) {
    console.error('[api/analytics/online] count failed:', err);
    return null;
  }
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  // 由 start 内部赋值，cancel 时调用以释放定时器
  let dispose: () => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setInterval> | null = null;
      let endTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        if (endTimer) clearTimeout(endTimer);
        try {
          controller.close();
        } catch { /* 已关闭 */ }
      };
      dispose = cleanup;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const tick = async () => {
        const n = await countOnline();
        if (n === null) {
          // 统计库异常时发送注释心跳，保持连接不中断
          send(': heartbeat\n\n');
          return;
        }
        send(`data: ${JSON.stringify({ online: n })}\n\n`);
      };

      req.signal?.addEventListener('abort', cleanup);

      // 首帧先推一次，避免客户端等待 5 秒
      send('retry: 5000\n\n');
      await tick();

      if (closed) return;
      timer = setInterval(() => {
        void tick();
      }, INTERVAL_MS);

      // 30 分钟后主动关闭，客户端会自动重连
      endTimer = setTimeout(() => {
        send(': timeout\n\n');
        cleanup();
      }, MAX_DURATION_MS);
    },
    cancel() {
      dispose();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
