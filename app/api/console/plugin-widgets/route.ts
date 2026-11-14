// app/api/console/plugin-widgets/route.ts — 仪表盘插件小部件（服务端渲染 HTML）
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { collectDashboardWidgets } from '@/lib/plugin/ui';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const check = await requirePermission('console:access');
  if (check) return check;

  try {
    const widgets = await collectDashboardWidgets();
    return NextResponse.json({ widgets });
  } catch {
    return NextResponse.json({ widgets: [] });
  }
}
