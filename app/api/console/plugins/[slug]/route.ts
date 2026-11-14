// app/api/console/plugins/[slug]/route.ts — 插件资源级操作：DELETE 卸载（仅管理员）
// 内置插件（source=builtin）只允许停用不允许卸载；上传插件删除目录 + DB 记录
// keepData=1 保留插件独立库（db/plugins/<slug>.db），重装后数据仍在；否则连数据一起删除
import { NextResponse, NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { resetPluginCache } from '@/lib/plugin/engine';
import { closePluginDb } from '@/lib/plugin-db';
import { rmDirSafe } from '@/lib/ext-installer';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('plugin:uninstall');
  if (check) return check;

  const { slug } = await params;
  const keepData = req.nextUrl.searchParams.get('keepData') === '1';

  const existing = await db.plugin.findUnique({ where: { slug } });
  const pluginDir = path.join(process.cwd(), 'scripts', 'plugins', slug);

  if (!existing && !fs.existsSync(pluginDir)) {
    return NextResponse.json({ error: '插件不存在' }, { status: 404 });
  }
  if (existing?.source === 'builtin') {
    return NextResponse.json({ error: '内置插件不允许卸载 如需关闭请使用停用' }, { status: 400 });
  }

  try {
    // 先停用再卸载
    if (existing?.isActive) {
      await db.plugin.update({ where: { slug }, data: { isActive: false } });
    }
    // 删除安装目录（Windows 句柄占用时 rename 兜底）
    if (fs.existsSync(pluginDir)) {
      rmDirSafe(pluginDir);
    }
    // 删除 DB 记录
    if (existing) {
      await db.plugin.delete({ where: { slug } });
    }
    // 处理插件独立库
    if (!keepData) {
      closePluginDb(slug);
      for (const suffix of ['', '-wal', '-shm']) {
        const f = path.join(process.cwd(), 'db', 'plugins', `${slug}.db${suffix}`);
        if (fs.existsSync(f)) fs.rmSync(f, { force: true });
      }
    }
  } catch (err) {
    console.error('[api/console/plugins/uninstall] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '卸载失败' }, { status: 500 });
  }

  resetPluginCache();
  console.log(`[Plugin] ${slug} 已卸载（${keepData ? '保留数据' : '数据已删除'}）`);
  return NextResponse.json({ ok: true, slug, keepData });
}
