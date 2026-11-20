// lib/cron/publish-scheduled.ts — 定时发布：把到点的 SCHEDULED 文章改为 PUBLISHED
import { revalidatePath } from 'next/cache';
import { db } from '../prisma';

export async function publishScheduledPosts(): Promise<number> {
  const now = new Date();

  const due = await db.post.findMany({
    where: {
      status: 'SCHEDULED',
      publishedAt: { not: null, lte: now },
    },
    select: { id: true, slug: true },
  });
  if (due.length === 0) return 0;

  await db.post.updateMany({
    where: { id: { in: due.map((p) => p.id) }, status: 'SCHEDULED' },
    data: { status: 'PUBLISHED' },
  });

  // 刷新前台缓存；定时任务上下文不可用时忽略（不影响发布结果）
  try {
    revalidatePath('/', 'layout');
    for (const post of due) {
      revalidatePath(`/blog/${post.slug}`);
    }
  } catch (err) {
    console.error('[Cron] 定时发布刷新缓存失败（重启/访问后自动生效）:', err);
  }

  console.log(`[Cron] ✓ 定时发布 ${due.length} 篇文章：${due.map((p) => p.slug).join(', ')}`);
  return due.length;
}
