// app/api/console/plugins/[slug]/activate/route.ts — 启用插件
import { NextResponse, NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { resetPluginCache } from '@/lib/plugin/engine';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('plugin:activate');
  if (check) return check;

  const { slug } = await params;

  // 校验插件存在于磁盘
  const jsonPath = path.join(process.cwd(), 'scripts', 'plugins', slug, 'plugin.json');
  if (!fs.existsSync(jsonPath)) {
    return NextResponse.json({ error: '插件不存在或 plugin.json 缺失' }, { status: 404 });
  }
  let meta: { name: string; version: string; description?: string; author?: string };
  try {
    meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return NextResponse.json({ error: 'plugin.json 解析失败' }, { status: 500 });
  }

  try {
    await db.plugin.upsert({
      where: { slug },
      update: { isActive: true },
      create: {
        slug,
        name: meta.name || slug,
        version: meta.version || '0.0.0',
        description: meta.description ?? null,
        author: meta.author ?? null,
        isActive: true,
      },
    });
  } catch (err) {
    console.error('[api/console/plugins/activate] failed:', err);
    return NextResponse.json({ error: '启用插件失败' }, { status: 500 });
  }

  resetPluginCache();
  return NextResponse.json({ ok: true, slug, isActive: true });
}
