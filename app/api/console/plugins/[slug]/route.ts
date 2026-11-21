// app/api/console/plugins/[slug]/route.ts — 插件资源级操作：DELETE 卸载（仅管理员）
// 内置插件（source=builtin）只允许停用不允许卸载；上传插件删除目录 + DB 记录
// keepData=1 保留插件数据（db/plugins-db/<slug>.db 与 db/plugins-json/<slug>.run.json、.config.json），
// 否则连数据一起删除
import { NextResponse, NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { resetPluginCache } from '@/lib/plugin/engine';
import { closePluginDb } from '@/lib/plugin-db';
import { deletePluginJsonFiles } from '@/lib/plugin/json-store';
import { rmDirSafe, revalidateSitePages } from '@/lib/ext-installer';

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
  // 内置插件（native）不允许卸载：以磁盘清单为准
  const diskManifestPath = path.join(pluginDir, 'plugin.json');
  if (fs.existsSync(diskManifestPath)) {
    try {
      const diskMeta = JSON.parse(fs.readFileSync(diskManifestPath, 'utf-8'));
      if (diskMeta?.native === true) {
        return NextResponse.json({ error: '内置插件不可卸载' }, { status: 403 });
      }
    } catch {
      // 清单解析失败时继续走原有校验，不阻断卸载
    }
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
        const f = path.join(process.cwd(), 'db', 'plugins-db', `${slug}.db${suffix}`);
        if (fs.existsSync(f)) fs.rmSync(f, { force: true });
      }
      // 删除 JSON 存储（run.json 运行数据 + config.json 配置）
      deletePluginJsonFiles(slug);
    }
  } catch (err) {
    console.error('[api/console/plugins/uninstall] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '卸载失败' }, { status: 500 });
  }

  resetPluginCache();
  revalidateSitePages();
  console.log(`[Plugin] ${slug} 已卸载（${keepData ? '保留数据' : '数据已删除'}）`);
  return NextResponse.json({ ok: true, slug, keepData });
}
