// lib/backup/index.ts — 站点备份管理（创建 / 列表 / 删除 / 打包下载 / 恢复）
// 备份目录结构：db/backups/<YYYYMMDD-HHmmss>/
//   blog.db / analytics.db / plugins-db/*.db / plugins-json/* / meta.json
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import AdmZip from 'adm-zip';
import { db } from '../prisma';
import { analytics } from '../analytics';
import { getSiteSetting } from '../site';

export const DB_DIR = path.join(process.cwd(), 'db');
export const BACKUP_DIR = path.join(DB_DIR, 'backups');

// SQLite 文件头（含末尾的 \0）
const SQLITE_HEADER = 'SQLite format 3\u0000';

export type BackupType = 'manual' | 'auto';

export interface BackupMeta {
  name: string;
  createdAt: string;
  type: BackupType;
  size: number;
  files: string[];
  version: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// 目录名使用本地时间戳，字典序即时间序
function timestamp(d = new Date()): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries: Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += await dirSize(p);
      else total += (await fsp.stat(p)).size;
    } catch {
      /* 单个文件读取失败不影响整体统计 */
    }
  }
  return total;
}

// 用 better-sqlite3 在线备份，自动包含 WAL 中尚未合并的数据
async function backupSqlite(src: string, dest: string): Promise<void> {
  const conn = new Database(src, { readonly: true, fileMustExist: true });
  try {
    await conn.backup(dest);
  } finally {
    conn.close();
  }
  // 备份完成后清掉目标库可能残留的日志文件，保证备份包干净
  for (const suffix of ['-journal', '-wal', '-shm']) {
    await fsp.rm(dest + suffix, { force: true }).catch(() => {});
  }
}

// 校验是否为合法 SQLite 文件
export function isSqliteFile(buffer: Buffer): boolean {
  return buffer.length >= 16 && buffer.subarray(0, 16).toString('latin1') === SQLITE_HEADER;
}

// 备份名称白名单，防止路径穿越
export function safeBackupDir(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('备份名称不合法');
  const dir = path.join(BACKUP_DIR, name);
  if (path.dirname(dir) !== BACKUP_DIR) throw new Error('备份名称不合法');
  return dir;
}

// 创建一份完整备份
export async function createBackup(
  opts: { type?: BackupType; keep?: number } = {}
): Promise<BackupMeta> {
  const type = opts.type ?? 'manual';
  await fsp.mkdir(BACKUP_DIR, { recursive: true });

  const base = timestamp();
  let name = base;
  for (let i = 1; fs.existsSync(path.join(BACKUP_DIR, name)); i++) {
    name = `${base}-${i}`;
  }
  const dir = path.join(BACKUP_DIR, name);
  await fsp.mkdir(dir, { recursive: true });

  const files: string[] = [];

  // ① 主库 + 统计库
  for (const dbName of ['blog.db', 'analytics.db']) {
    const src = path.join(DB_DIR, dbName);
    if (!fs.existsSync(src)) continue;
    await backupSqlite(src, path.join(dir, dbName));
    files.push(dbName);
  }

  // ② 插件数据库（db/plugins-db/*.db）
  const pluginDbDir = path.join(DB_DIR, 'plugins-db');
  if (fs.existsSync(pluginDbDir)) {
    const dbFiles = (await fsp.readdir(pluginDbDir)).filter((file) => file.endsWith('.db'));
    if (dbFiles.length > 0) {
      const outDir = path.join(dir, 'plugins-db');
      await fsp.mkdir(outDir, { recursive: true });
      for (const file of dbFiles) {
        await backupSqlite(path.join(pluginDbDir, file), path.join(outDir, file));
        files.push(`plugins-db/${file}`);
      }
    }
  }

  // ③ 插件 JSON 数据（db/plugins-json）
  const pluginJsonDir = path.join(DB_DIR, 'plugins-json');
  if (fs.existsSync(pluginJsonDir)) {
    await fsp.cp(pluginJsonDir, path.join(dir, 'plugins-json'), { recursive: true });
    files.push('plugins-json');
  }

  const meta: BackupMeta = {
    name,
    createdAt: new Date().toISOString(),
    type,
    size: await dirSize(dir),
    files,
    version: 1,
  };
  await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  // 自动备份按保留份数清理（手动备份不受影响）
  if (type === 'auto') {
    let keep = opts.keep;
    if (keep === undefined) {
      try {
        keep = (await getSiteSetting()).autoBackupKeep;
      } catch {
        keep = 7;
      }
    }
    await pruneAutoBackups(keep);
  }

  return meta;
}

// 只清理自动备份，保留最近 keep 份
export async function pruneAutoBackups(keep: number): Promise<void> {
  if (!Number.isFinite(keep) || keep < 1) return;
  const list = (await listBackups()).filter((b) => b.type === 'auto');
  for (const old of list.slice(keep)) {
    try {
      await fsp.rm(path.join(BACKUP_DIR, old.name), { recursive: true, force: true });
      console.log(`[Backup] 已清理过期自动备份：${old.name}`);
    } catch (err) {
      console.error(`[Backup] 清理自动备份失败 ${old.name}:`, err);
    }
  }
}

// 列出所有备份（按时间倒序）
export async function listBackups(): Promise<BackupMeta[]> {
  try {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
  } catch {
    return [];
  }

  let entries: Dirent[];
  try {
    entries = await fsp.readdir(BACKUP_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const list: BackupMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(BACKUP_DIR, entry.name);
    let meta: BackupMeta | null = null;
    try {
      const raw = await fsp.readFile(path.join(dir, 'meta.json'), 'utf-8');
      meta = JSON.parse(raw) as BackupMeta;
    } catch {
      /* meta.json 缺失或损坏时按目录信息兜底 */
    }
    if (!meta) {
      let createdAt = new Date().toISOString();
      try {
        createdAt = (await fsp.stat(dir)).mtime.toISOString();
      } catch {
        /* ignore */
      }
      meta = {
        name: entry.name,
        createdAt,
        type: 'manual',
        size: await dirSize(dir),
        files: [],
        version: 1,
      };
    }
    list.push({ ...meta, name: entry.name });
  }

  list.sort((a, b) => b.name.localeCompare(a.name));
  return list;
}

// 删除单个备份
export async function deleteBackup(name: string): Promise<void> {
  const dir = safeBackupDir(name);
  await fsp.rm(dir, { recursive: true, force: true });
}

// 把备份目录打包成 zip（用于下载）
export async function zipBackup(name: string): Promise<Buffer> {
  const dir = safeBackupDir(name);
  const stat = await fsp.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) throw new Error('备份不存在');
  const zip = new AdmZip();
  zip.addLocalFolder(dir);
  return zip.toBuffer();
}

// 断开 Prisma 连接，避免恢复时文件被占用
async function disconnectPrisma(): Promise<void> {
  try {
    await db.$disconnect();
  } catch { /* ignore */ }
  try {
    await analytics.$disconnect();
  } catch { /* ignore */ }
}

async function connectPrisma(): Promise<void> {
  try {
    await db.$connect();
  } catch (err) {
    console.error('[Backup] 主库重连失败（重启服务后生效）:', err);
  }
  try {
    await analytics.$connect();
  } catch (err) {
    console.error('[Backup] 统计库重连失败（重启服务后生效）:', err);
  }
}

// 清空 generated/prisma 的 require 缓存（尽力而为，避免旧模块状态残留）
function clearGeneratedRequireCache(): void {
  try {
    const nodeRequire = process.getBuiltinModule('node:module').createRequire(
      path.join(process.cwd(), 'package.json')
    );
    const marker = path.join('generated', 'prisma');
    for (const key of Object.keys(nodeRequire.cache)) {
      if (key.includes(marker)) delete nodeRequire.cache[key];
    }
  } catch (err) {
    console.error('[Backup] 清理模块缓存失败:', err);
  }
}

export interface RestoreResult {
  preBackup: string;
  restored: string[];
}

// 从上传的 .db / 备份 zip 恢复
export async function restoreFromUpload(buffer: Buffer, filename: string): Promise<RestoreResult> {
  const lower = filename.toLowerCase();
  const targets: { dest: string; data: Buffer }[] = [];

  if (lower.endsWith('.zip')) {
    const zip = new AdmZip(buffer);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const entryName = entry.entryName.replace(/\\/g, '/');
      const base = path.posix.basename(entryName);
      const data = entry.getData();

      if (base === 'blog.db' || base === 'analytics.db') {
        if (!isSqliteFile(data)) throw new Error(`${base} 不是合法的 SQLite 文件`);
        targets.push({ dest: path.join(DB_DIR, base), data });
        continue;
      }
      const pluginDb = entryName.match(/(?:^|\/)plugins-db\/([^/]+\.db)$/);
      if (pluginDb) {
        if (!isSqliteFile(data)) throw new Error(`${pluginDb[1]} 不是合法的 SQLite 文件`);
        targets.push({ dest: path.join(DB_DIR, 'plugins-db', pluginDb[1]), data });
        continue;
      }
      const pluginJson = entryName.match(/(?:^|\/)plugins-json\/([^/]+)$/);
      if (pluginJson) {
        targets.push({ dest: path.join(DB_DIR, 'plugins-json', pluginJson[1]), data });
      }
    }
    if (targets.length === 0) throw new Error('压缩包中没有找到可恢复的数据库文件');
  } else {
    if (!isSqliteFile(buffer)) throw new Error('文件不是合法的 SQLite 数据库');
    // 依据文件名判断目标库，默认恢复主库
    const target = lower.includes('analytics') ? 'analytics.db' : 'blog.db';
    targets.push({ dest: path.join(DB_DIR, target), data: buffer });
  }

  // 恢复前先自动备份当前库
  const pre = await createBackup({ type: 'manual' });

  await disconnectPrisma();

  // 关闭插件数据库连接，避免 Windows 下文件被占用无法覆盖
  try {
    const { closeAllPluginDbs } = await import('../plugin-db');
    closeAllPluginDbs();
  } catch (err) {
    console.error('[Backup] 关闭插件数据库连接失败:', err);
  }

  for (const { dest, data } of targets) {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    // 清掉旧的 WAL / 日志，防止与新库内容混杂
    for (const suffix of ['-wal', '-shm', '-journal']) {
      await fsp.rm(dest + suffix, { force: true }).catch(() => {});
    }
    await fsp.writeFile(dest, data);
  }

  clearGeneratedRequireCache();
  await connectPrisma();

  return {
    preBackup: pre.name,
    restored: targets.map((t) => path.relative(DB_DIR, t.dest).replace(/\\/g, '/')),
  };
}
