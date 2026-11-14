// app/api/console/plugins/[slug]/deactivate/route.ts — 禁用插件
import { NextResponse, NextRequest } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { resetPluginCache } from '@/lib/plugin/engine';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('plugin:deactivate');
  if (check) return check;

  const { slug } = await params;

  const existing = await db.plugin.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: '插件记录不存在' }, { status: 404 });
  }

  try {
    await db.plugin.update({ where: { slug }, data: { isActive: false } });
  } catch (err) {
    console.error('[api/console/plugins/deactivate] failed:', err);
    return NextResponse.json({ error: '禁用插件失败' }, { status: 500 });
  }

  resetPluginCache();
  return NextResponse.json({ ok: true, slug, isActive: false });
}
