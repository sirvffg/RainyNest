// app/api/cron/analytics/route.ts — 定时聚合触发端点
// 自托管：scheduler.ts 内部调用；外部：curl 带 CRON_SECRET 调用
import { headers } from 'next/headers';
import { runMinuteAggregation } from '@/lib/analytics/aggregator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const authHeader = (await headers()).get('authorization');
  // 未配置 CRON_SECRET 时仅允许本机调度
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runMinuteAggregation();
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
