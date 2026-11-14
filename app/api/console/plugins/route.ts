// app/api/console/plugins/route.ts — 插件列表（直接扫 vendor/plugins 读 plugin.json + 数据库合并）
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { requireSession } from '@/lib/api-auth';
import { db } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const pluginsDir = path.join(process.cwd(), 'vendor', 'plugins');
  const metas: Record<string, unknown>[] = [];
  if (fs.existsSync(pluginsDir)) {
    const dirs = fs.readdirSync(pluginsDir).filter((d) => fs.statSync(path.join(pluginsDir, d)).isDirectory());
    for (const dir of dirs) {
      const jsonPath = path.join(pluginsDir, dir, 'plugin.json');
      if (!fs.existsSync(jsonPath)) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        metas.push({ ...meta, slug: meta.slug || dir });
      } catch (err) {
        console.error(`[api/console/plugins] ${dir}: plugin.json 解析失败`, err);
      }
    }
  }

  const dbPlugins = await db.plugin.findMany().catch(() => []);
  const bySlug = new Map(dbPlugins.map((p) => [p.slug, p]));
  const scanned = new Set<string>();

  const list: Record<string, unknown>[] = metas.map((meta) => {
    const slug = String(meta.slug);
    scanned.add(slug);
    const dbEntry = bySlug.get(slug);
    return {
      ...meta,
      isActive: dbEntry?.isActive ?? false,
      config: dbEntry?.config ? safeParse(dbEntry.config) : null,
      installedAt: dbEntry?.installedAt ?? null,
      updatedAt: dbEntry?.updatedAt ?? null,
    };
  });

  // 数据库有记录但磁盘缺失的插件（标记 missing）
  for (const p of dbPlugins) {
    if (scanned.has(p.slug)) continue;
    list.push({
      slug: p.slug,
      name: p.name,
      version: p.version,
      description: p.description ?? undefined,
      author: p.author ?? undefined,
      isActive: p.isActive,
      config: p.config ? safeParse(p.config) : null,
      installedAt: p.installedAt,
      updatedAt: p.updatedAt,
      missing: true,
    });
  }

  return NextResponse.json({ list });
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
