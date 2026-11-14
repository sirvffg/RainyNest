// app/api/console/themes/route.ts — 主题列表（磁盘 theme.json + 数据库记录合并）
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { scanInstalledThemes } from '@/lib/theme';
import type { ThemeMeta } from '@/lib/theme';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const [metas, dbThemes] = await Promise.all([
    scanInstalledThemes().catch(() => [] as ThemeMeta[]),
    db.theme.findMany().catch(() => []),
  ]);

  const bySlug = new Map(dbThemes.map((t) => [t.slug, t]));
  const scanned = new Set<string>();

  const list: Record<string, unknown>[] = metas.map((meta: ThemeMeta) => {
    scanned.add(meta.slug);
    const dbEntry = bySlug.get(meta.slug);
    return {
      ...meta,
      isActive: dbEntry?.isActive ?? false,
      config: dbEntry?.config ? safeParse(dbEntry.config) : null,
      source: dbEntry?.source ?? 'builtin',
      installedAt: dbEntry?.installedAt ?? null,
      updatedAt: dbEntry?.updatedAt ?? null,
    };
  });

  // 数据库里有但磁盘缺失的主题也列出（标记 missing）
  for (const t of dbThemes) {
    if (scanned.has(t.slug)) continue;
    list.push({
      slug: t.slug,
      name: t.name,
      version: t.version,
      description: t.description ?? undefined,
      author: t.author ?? undefined,
      preview: t.preview ?? undefined,
      supports: [],
      configSchema: {},
      isActive: t.isActive,
      config: t.config ? safeParse(t.config) : null,
      source: t.source,
      installedAt: t.installedAt,
      updatedAt: t.updatedAt,
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
