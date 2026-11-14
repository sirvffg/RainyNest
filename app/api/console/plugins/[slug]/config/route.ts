// app/api/console/plugins/[slug]/config/route.ts — 插件配置保存
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { resetPluginCache } from '@/lib/plugin/engine';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

const putSchema = z.object({
  config: z.record(z.unknown()),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('plugin:config');
  if (check) return check;

  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'config 必须是对象' }, { status: 400 });
  }

  try {
    await db.plugin.upsert({
      where: { slug },
      update: { config: JSON.stringify(parsed.data.config) },
      create: {
        slug,
        name: slug,
        version: '0.0.0',
        config: JSON.stringify(parsed.data.config),
      },
    });
  } catch (err) {
    console.error('[api/console/plugins/config] failed:', err);
    return NextResponse.json({ error: '保存插件配置失败' }, { status: 500 });
  }

  resetPluginCache();
  return NextResponse.json({ ok: true });
}
