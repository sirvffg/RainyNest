// app/api/console/themes/[slug]/route.ts — 主题资源级操作：DELETE 卸载（仅管理员）
// 内置主题（source=builtin）不允许卸载；使用中的主题需先切换到其他主题
// 删除安装目录 + public/themes 静态资源副本 + DB 记录
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { clearThemeCache } from '@/lib/theme';
import { rmDirSafe, revalidateSitePages } from '@/lib/ext-installer';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const check = await requirePermission('theme:uninstall');
  if (check) return check;

  const { slug } = await params;

  const existing = await db.theme.findUnique({ where: { slug } });
  const themeDir = path.join(process.cwd(), 'scripts', 'themes', slug);

  if (!existing && !fs.existsSync(themeDir)) {
    return NextResponse.json({ error: '主题不存在' }, { status: 404 });
  }
  if (existing?.source === 'builtin') {
    return NextResponse.json({ error: '内置主题不允许卸载' }, { status: 400 });
  }
  if (existing?.isActive) {
    return NextResponse.json({ error: '该主题正在使用中 请先切换到其他主题' }, { status: 400 });
  }

  try {
    if (fs.existsSync(themeDir)) {
      rmDirSafe(themeDir);
    }
    if (existing) {
      await db.theme.delete({ where: { slug } });
    }
  } catch (err) {
    console.error('[api/console/themes/uninstall] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '卸载失败' }, { status: 500 });
  }

  clearThemeCache();
  revalidateSitePages();
  console.log(`[Theme] ${slug} 已卸载`);
  return NextResponse.json({ ok: true, slug });
}
