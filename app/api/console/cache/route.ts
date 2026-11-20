// app/api/console/cache/route.ts — 手动清缓存 / 维护操作
// 兼容旧版 { type: 'site' | 'theme' | 'all' }；新增 { action: 'views' | 'fts' | 'revalidate' | 'all' }
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import path from 'node:path';
import Database from 'better-sqlite3';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/api-auth';
import { clearSiteSettingCache } from '@/lib/site';
import { clearThemeCache } from '@/lib/theme';
import { resetPluginCache } from '@/lib/plugin/engine';
import { db } from '@/lib/prisma';

export const runtime = 'nodejs';

const bodySchema = z.object({
  action: z.enum(['views', 'fts', 'revalidate', 'all']).optional(),
  // 旧版缓存清理参数，保持向后兼容
  type: z.enum(['site', 'theme', 'all']).optional(),
});

// 重建 SQLite FTS5 索引（等价于 scripts/init-fts.js）
function rebuildFtsIndex(): void {
  const dbPath = path.join(process.cwd(), 'db', 'blog.db');
  const conn = new Database(dbPath, { timeout: 5000 });
  try {
    // 先删触发器再删表，避免残留引用
    conn.exec(`
      DROP TRIGGER IF EXISTS post_ai;
      DROP TRIGGER IF EXISTS post_ad;
      DROP TRIGGER IF EXISTS post_au;
      DROP TABLE IF EXISTS post_fts;
    `);

    conn.exec(`
      CREATE VIRTUAL TABLE post_fts USING fts5(
        title, summary, content,
        content='Post', content_rowid='rowid',
        tokenize='porter unicode61'
      );
    `);

    conn.exec(`
      CREATE TRIGGER post_ai AFTER INSERT ON Post BEGIN
        INSERT INTO post_fts(rowid, title, summary, content) VALUES (new.rowid, new.title, new.summary, new.content);
      END;

      CREATE TRIGGER post_ad AFTER DELETE ON Post BEGIN
        INSERT INTO post_fts(post_fts, rowid, title, summary, content) VALUES('delete', old.rowid, old.title, old.summary, old.content);
      END;

      CREATE TRIGGER post_au AFTER UPDATE ON Post BEGIN
        INSERT INTO post_fts(post_fts, rowid, title, summary, content) VALUES('delete', old.rowid, old.title, old.summary, old.content);
        INSERT INTO post_fts(rowid, title, summary, content) VALUES (new.rowid, new.title, new.summary, new.content);
      END;
    `);

    conn.exec(`INSERT INTO post_fts(post_fts) VALUES('rebuild');`);
  } finally {
    conn.close();
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'action 必须是 views / fts / revalidate / all；或 type 必须是 site / theme / all' },
      { status: 400 }
    );
  }

  const { action, type } = parsed.data;

  // ===== 新版维护动作 =====
  if (action) {
    const result: Record<string, unknown> = {};
    try {
      if (action === 'views' || action === 'all') {
        const updated = await db.post.updateMany({ data: { views: 0 } });
        result.views = updated.count;
      }
      if (action === 'fts' || action === 'all') {
        rebuildFtsIndex();
        result.fts = true;
      }
      if (action === 'revalidate' || action === 'all') {
        revalidatePath('/', 'layout');
        result.revalidate = true;
      }
    } catch (err) {
      console.error('[api/console/cache] maintenance failed:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : '维护操作失败' },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, action, result });
  }

  // ===== 旧版缓存清理（兼容） =====
  if (!type) {
    return NextResponse.json({ error: '缺少 action 或 type 参数' }, { status: 400 });
  }
  if (type === 'site' || type === 'all') clearSiteSettingCache();
  if (type === 'theme' || type === 'all') {
    clearThemeCache();
    resetPluginCache();
  }

  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, type });
}
