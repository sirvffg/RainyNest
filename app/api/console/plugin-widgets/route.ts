// app/api/console/plugin-widgets/route.ts — 仪表盘插件小部件（服务端渲染 HTML）
import { NextResponse } from 'next/server';
import { requirePermission, requireSession } from '@/lib/api-auth';
import { collectDashboardWidgets, collectQuickActions } from '@/lib/plugin/ui';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const check = await requirePermission('console:access');
  if (check) return check;
  const session = await requireSession();
  const permissions = session?.user?.permissions;

  try {
    const [widgets, quickActions] = await Promise.all([
      collectDashboardWidgets(permissions),
      collectQuickActions(permissions),
    ]);
    return NextResponse.json({ widgets, quickActions });
  } catch {
    return NextResponse.json({ widgets: [], quickActions: [] });
  }
}
