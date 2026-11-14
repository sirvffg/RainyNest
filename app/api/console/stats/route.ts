// app/api/console/stats/route.ts — 控制台概览统计
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { analytics } from '@/lib/analytics';

export const runtime = 'nodejs';

// 在线判定窗口：5 分钟内活跃
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export async function GET() {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const [posts, publishedPosts, comments, pendingComments, viewsAgg, recentComments, topPosts] =
    await Promise.all([
      db.post.count(),
      db.post.count({ where: { status: 'PUBLISHED' } }),
      db.comment.count(),
      db.comment.count({ where: { status: 'PENDING' } }),
      db.post.aggregate({ _sum: { views: true } }),
      db.comment.findMany({
        include: {
          user: { select: { id: true, username: true, displayName: true, avatar: true } },
          post: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.post.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, title: true, slug: true, views: true },
        orderBy: { views: 'desc' },
        take: 5,
      }),
    ]);

  // 在线人数（analytics 库，异常兜底 0）
  let online = 0;
  try {
    online = await analytics.onlineVisitor.count({
      where: { lastSeen: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) } },
    });
  } catch { /* analytics 库不可用 */ }

  return NextResponse.json({
    posts,
    publishedPosts,
    comments,
    pendingComments,
    views: viewsAgg._sum.views ?? 0,
    online,
    recentComments,
    topPosts,
  });
}
