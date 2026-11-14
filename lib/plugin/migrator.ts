// lib/plugin/migrator.ts — 插件 migration 执行器（安装/升级时自动跑）
import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { getPluginDb } from '../plugin-db';

const PLUGINS_DIR = path.join(process.cwd(), 'scripts', 'plugins');
const MIGRATIONS_TABLE = '_rn_migrations';

function ensureMigrationsTable(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      description TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checksum TEXT
    );
  `);
}

export function runPluginMigrations(slug: string, pluginJson: { database?: { enabled?: boolean; migrations?: { version: string; description?: string; file: string }[] } }) {
  if (!pluginJson.database?.enabled) return;
  if (!pluginJson.database?.migrations?.length) return;

  const db = getPluginDb(slug);
  ensureMigrationsTable(db);

  const applied = new Set(
    (db.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`).all() as { version: string }[]).map(
      (row) => row.version
    )
  );

  const pluginDir = path.join(PLUGINS_DIR, slug);

  for (const mig of pluginJson.database.migrations) {
    if (applied.has(mig.version)) continue;

    const sqlPath = path.join(pluginDir, mig.file);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`[Plugin] ${slug} migration ${sqlPath} not found, skip`);
      continue;
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');
    db.exec(sql);
    db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (version, description, checksum) VALUES (?, ?, ?)`)
      .run(mig.version, mig.description ?? null, null);
    console.log(`[Plugin] ${slug} migration applied: ${mig.version}`);
  }
}
