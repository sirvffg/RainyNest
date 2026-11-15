// lib/plugin-db.ts — 插件独立数据库（better-sqlite3 原生连接）
// 每个插件一个 <slug>.db 文件，放在 db/plugins-db/ 下，WAL 模式
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const PLUGIN_DB_DIR = path.join(process.cwd(), 'db', 'plugins-db');

const dbCache = new Map<string, Database.Database>();

export function getPluginDb(slug: string): Database.Database {
  if (dbCache.has(slug)) return dbCache.get(slug)!;

  fs.mkdirSync(PLUGIN_DB_DIR, { recursive: true });

  const dbPath = path.join(PLUGIN_DB_DIR, `${slug}.db`);
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  dbCache.set(slug, db);
  return db;
}

export function closeAllPluginDbs() {
  for (const [slug, db] of dbCache) {
    try {
      db.close();
      console.log(`[Plugin-DB] Closed ${slug}.db`);
    } catch { /* ignore */ }
  }
  dbCache.clear();
}

// 关闭单个插件的数据库连接（卸载/清数据前调用）
export function closePluginDb(slug: string) {
  const db = dbCache.get(slug);
  if (!db) return;
  try {
    db.close();
  } catch { /* ignore */ }
  dbCache.delete(slug);
}
