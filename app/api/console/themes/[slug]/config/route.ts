// app/api/console/themes/[slug]/config/route.ts — 主题配置保存
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { clearThemeCache, scanInstalledThemes } from '@/lib/theme';
import type { ThemeMeta } from '@/lib/theme';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

const putSchema = z.object({
  config: z.record(z.unknown()),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('theme:config');
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

  const metas = await scanInstalledThemes().catch(() => [] as ThemeMeta[]);
  const meta = metas.find((m) => m.slug === slug);
  if (!meta) {
    return NextResponse.json({ error: '主题不存在或 theme.json 缺失' }, { status: 404 });
  }

  try {
    await db.theme.upsert({
      where: { slug },
      update: { config: JSON.stringify(parsed.data.config) },
      create: {
        slug,
        name: meta.name,
        version: meta.version,
        description: meta.description ?? null,
        author: meta.author ?? null,
        preview: meta.preview ?? null,
        config: JSON.stringify(parsed.data.config),
      },
    });
  } catch (err) {
    console.error('[api/console/themes/config] failed:', err);
    return NextResponse.json({ error: '保存主题配置失败' }, { status: 500 });
  }

  clearThemeCache();
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
