// app/api/cron/publish/route.ts — 定时发布触发端点（供外部 cron 调用）
import { headers } from 'next/headers';
import { publishScheduledPosts } from '@/lib/cron/publish-scheduled';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const authHeader = (await headers()).get('authorization');
  // 未配置 CRON_SECRET 时不做校验（本地/自托管便捷调用）
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const published = await publishScheduledPosts();
    return Response.json({ success: true, published });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : '定时发布失败' },
      { status: 500 }
    );
  }
}
