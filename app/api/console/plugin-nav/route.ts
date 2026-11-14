// app/api/console/plugin-nav/route.ts — 后台侧栏插件菜单（客户端局部刷新用）
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPluginNavItems } from '@/lib/plugin/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const check = await requirePermission('console:access');
  if (check) return check;

  try {
    const items = await getPluginNavItems();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
