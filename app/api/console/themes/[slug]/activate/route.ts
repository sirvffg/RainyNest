// app/api/console/themes/[slug]/activate/route.ts — 激活主题（事务切换 isActive）
import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { clearThemeCache, scanInstalledThemes, isThemeCompatible } from '@/lib/theme';
import type { ThemeMeta } from '@/lib/theme';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('theme:activate');
  if (check) return check;

  const { slug } = await params;

  // 从磁盘 theme.json 校验主题存在并取元数据
  const metas = await scanInstalledThemes().catch(() => [] as ThemeMeta[]);
  const meta = metas.find((m) => m.slug === slug);
  if (!meta) {
    return NextResponse.json({ error: '主题不存在或 theme.json 缺失' }, { status: 404 });
  }
  if (!isThemeCompatible(meta)) {
    return NextResponse.json(
      { error: `主题要求核心版本 ${meta.minRainyNestVersion ?? '*'} ~ ${meta.maxRainyNestVersion ?? '*'}，与当前核心版本不兼容` },
      { status: 400 }
    );
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. 全部取消激活
      await tx.theme.updateMany({ data: { isActive: false } });
      // 2. 激活目标主题（无 DB 记录则补录）
      await tx.theme.upsert({
        where: { slug },
        update: { isActive: true, name: meta.name, version: meta.version, description: meta.description ?? null, author: meta.author ?? null, preview: meta.preview ?? null },
        create: {
          slug,
          name: meta.name,
          version: meta.version,
          description: meta.description ?? null,
          author: meta.author ?? null,
          preview: meta.preview ?? null,
          isActive: true,
        },
      });
    });
  } catch (err) {
    console.error('[api/console/themes/activate] failed:', err);
    return NextResponse.json({ error: '激活主题失败' }, { status: 500 });
  }

  clearThemeCache();
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, slug });
}
