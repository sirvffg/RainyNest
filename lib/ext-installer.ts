// lib/ext-installer.ts — 扩展包安装器（插件/主题共用）
// 解包校验 → 备份旧目录 → 落盘 → 迁移/静态资源 → DB upsert → 热重载，失败自动回滚
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { revalidatePath } from 'next/cache';
import AdmZip from 'adm-zip';
import { db } from './prisma';
import { reloadPlugin } from './plugin/engine';
import { compareSemver, getCoreVersion, satisfiesCoreVersion } from './plugin/semver';
import { clearThemeCache } from './theme';
import { runPluginMigrations } from './plugin/migrator';

const PLUGINS_DIR = path.join(process.cwd(), 'scripts', 'plugins');
const THEMES_DIR = path.join(process.cwd(), 'scripts', 'themes');

export const MAX_PACKAGE_SIZE = 20 * 1024 * 1024; // 20MB
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const ALLOWED = new Set(['.js', '.tsx', '.json', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.sql', '.md', '.txt', '.woff', '.woff2', '.ttf']);

export type ExtKind = 'plugin' | 'theme';
export type Container = 'zip' | 'gz';

// 文件名识别类型与容器：{slug}.zip.rainy-plugin / {slug}.gz.rainy-theme
export function parsePackageFilename(name: string): { kind: ExtKind; container: Container } | null {
  const lower = name.toLowerCase();
  for (const [suffix, kind] of [
    ['.zip.rainy-plugin', 'plugin'],
    ['.gz.rainy-plugin', 'plugin'],
    ['.zip.rainy-theme', 'theme'],
    ['.gz.rainy-theme', 'theme'],
  ] as const) {
    if (lower.endsWith(suffix)) {
      return { kind, container: lower.includes('.zip.rainy') ? 'zip' : 'gz' };
    }
  }
  return null;
}

function extractZip(buffer: Buffer, dest: string): void {
  const zip = new AdmZip(buffer);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, '/');
    const target = path.resolve(dest, name);
    if (!target.startsWith(path.resolve(dest) + path.sep)) throw new Error(`非法路径: ${name}`);
    if (!ALLOWED.has(path.extname(name).toLowerCase())) throw new Error(`不允许的文件类型: ${name}`);
    if (entry.header.size > MAX_PACKAGE_SIZE) throw new Error(`文件过大: ${name}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.getData());
  }
}

function extractGz(buffer: Buffer, dest: string): void {
  const tmpTar = path.join(os.tmpdir(), `ext-${Date.now()}-${Math.random().toString(36).slice(2)}.tar.gz`);
  fs.writeFileSync(tmpTar, buffer);
  try {
    execFileSync('tar', ['-xzf', tmpTar, '-C', dest], { stdio: 'pipe' });
  } finally {
    fs.rmSync(tmpTar, { force: true });
  }
  const root = path.resolve(dest);
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (!path.resolve(full).startsWith(root)) throw new Error(`非法路径: ${item}`);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (!ALLOWED.has(path.extname(item).toLowerCase())) throw new Error(`不允许的文件类型: ${item}`);
    }
  };
  walk(dest);
}

// 主题静态资源由 app/themes/[slug]/[...path] 路由动态服务（next start 不会热加载 public/），
// 安装/卸载无需再维护 public/themes 副本

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 目录名匹配安装器产生的临时目录（备份/待删），列表扫描时跳过
const TEMP_DIR_RE = /(\.bak-\d+|\.deleted-\d+)$/;

// 扩展安装态变化（安装/升级/卸载/配置/启停）后让全站静态页重新生成，
// 否则 injectHead / 主题样式等运行时内容在预渲染页面上不会出现
export function revalidateSitePages(): void {
  revalidatePath('/', 'layout');
}

// 安全删除目录：Windows 下 rmSync 可能因句柄占用静默失败（内容仍在），
// 先直接删；不行则改名为 .deleted-xxx（rename 不受读句柄影响）再删；仍失败留待启动清扫
export function rmDirSafe(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch { /* fallthrough */ }
  if (!fs.existsSync(dir)) return;
  const trash = `${dir}.deleted-${Date.now()}`;
  try {
    fs.renameSync(dir, trash);
  } catch {
    return; // 连 rename 都失败：保留现场，不阻塞业务
  }
  try {
    fs.rmSync(trash, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
  } catch (err) {
    console.warn(`[Installer] 待删目录清理失败（启动时会自动清扫）: ${trash}`, err);
  }
}

export { TEMP_DIR_RE };

export interface InstallResult {
  kind: ExtKind;
  slug: string;
  version: string;
  upgraded: boolean; // 是否覆盖了已装版本
}

export interface InstallOptions {
  // dev 热更新模式：跳过版本校验与 DB upsert，仅落盘 + 热重载
  dev?: boolean;
}

// 完整安装流程（后台上传用）：版本必须大于已装版本，失败自动回滚
export async function installFromBuffer(buffer: Buffer, filename: string, opts: InstallOptions = {}): Promise<InstallResult> {
  const parsed = parsePackageFilename(filename || '');
  if (!parsed) throw new Error('文件名无法识别：需要 *.zip.rainy-plugin 或 *.gz.rainy-theme');
  if (buffer.length > MAX_PACKAGE_SIZE) throw new Error(`包体积超过 ${MAX_PACKAGE_SIZE / 1024 / 1024}MB 上限`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-install-'));
  let backupDir: string | null = null;
  try {
    if (parsed.container === 'zip') extractZip(buffer, tmp);
    else extractGz(buffer, tmp);

    // 以内容识别类型（文件名仅作提示）
    const hasPluginJson = fs.existsSync(path.join(tmp, 'plugin.json'));
    const hasThemeJson = fs.existsSync(path.join(tmp, 'theme.json'));
    if (!hasPluginJson && !hasThemeJson) throw new Error('包根目录缺少 plugin.json / theme.json');
    const kind: ExtKind = hasPluginJson ? 'plugin' : 'theme';

    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, kind === 'plugin' ? 'plugin.json' : 'theme.json'), 'utf-8'));
    if (!manifest.slug || !SLUG_RE.test(manifest.slug)) throw new Error(`slug 非法: ${manifest.slug}（需匹配 ^[a-z0-9][a-z0-9-]*$）`);
    if (!manifest.name || !manifest.version) throw new Error('manifest 缺少 name / version');
    if (manifest.specVersion && manifest.specVersion !== '1.0') {
      throw new Error(
        `specVersion ${manifest.specVersion} 不受支持：specVersion 是清单（manifest）格式版本，当前只接受 "1.0"，与插件 SPI / 类型包版本无关`
      );
    }

    // 核心版本兼容性：上传时先校验 requiresCore，避免装完才发现不兼容
    if (manifest.requiresCore) {
      const coreVersion = getCoreVersion();
      if (!satisfiesCoreVersion(coreVersion, String(manifest.requiresCore))) {
        throw new Error(
          `插件要求核心版本 ${manifest.requiresCore}，当前核心版本 ${coreVersion}，无法安装`
        );
      }
    }

    const slug: string = manifest.slug;
    const destDir = path.join(kind === 'plugin' ? PLUGINS_DIR : THEMES_DIR, slug);

    // 内置插件（native）禁止被上传包覆盖
    if (kind === 'plugin' && fs.existsSync(destDir)) {
      let existingMeta: Record<string, unknown> | null = null;
      try {
        existingMeta = JSON.parse(fs.readFileSync(path.join(destDir, 'plugin.json'), 'utf-8'));
      } catch {
        existingMeta = null; // 旧清单损坏时不作为阻断面
      }
      if (existingMeta?.native === true) {
        throw new Error(`插件 ${slug} 为内置插件（native），不允许上传包覆盖`);
      }
    }

    // 升级校验：新版本必须大于已装版本（有磁盘目录但无 DB 记录视为首装）
    const existing =
      kind === 'plugin'
        ? await db.plugin.findUnique({ where: { slug } })
        : await db.theme.findUnique({ where: { slug } });
    const existedOnDisk = fs.existsSync(destDir);
    const upgraded = !opts.dev && (existedOnDisk || !!existing);
    if (!opts.dev && upgraded && existing && compareSemver(String(manifest.version), existing.version) <= 0) {
      throw new Error(`版本必须大于已装版本（当前 ${existing.version}，上传 ${manifest.version}）`);
    }

    // 备份旧目录（同卷 rename，失败兜底复制）
    if (existedOnDisk) {
      backupDir = `${destDir}.bak-${Date.now()}`;
      try {
        fs.renameSync(destDir, backupDir);
      } catch {
        copyDirRecursive(destDir, backupDir);
        fs.rmSync(destDir, { recursive: true, force: true });
      }
    }

    // 落盘新目录
    try {
      fs.mkdirSync(destDir, { recursive: true });
      copyDirRecursive(tmp, destDir);

      if (kind === 'plugin') {
        runPluginMigrations(slug, manifest);
        if (!opts.dev) {
          await db.plugin.upsert({
            where: { slug },
            update: {
              name: manifest.name,
              version: manifest.version,
              description: manifest.description ?? null,
              author: manifest.author ?? null,
              source: 'uploaded',
            },
            create: {
              slug,
              name: manifest.name,
              version: manifest.version,
              description: manifest.description ?? null,
              author: manifest.author ?? null,
              isActive: false,
              source: 'uploaded',
            },
          });
        }
        reloadPlugin(slug);
      } else {
        if (!opts.dev) {
          await db.theme.upsert({
            where: { slug },
            update: {
              name: manifest.name,
              version: manifest.version,
              description: manifest.description ?? null,
              author: manifest.author ?? null,
              preview: manifest.preview ?? null,
              source: 'uploaded',
            },
            create: {
              slug,
              name: manifest.name,
              version: manifest.version,
              description: manifest.description ?? null,
              author: manifest.author ?? null,
              preview: manifest.preview ?? null,
              isActive: false,
              source: 'uploaded',
            },
          });
        }
        clearThemeCache();
      }
    } catch (err) {
      // 回滚：删掉新目录，恢复备份
      try {
        fs.rmSync(destDir, { recursive: true, force: true });
        if (backupDir) {
          fs.renameSync(backupDir, destDir);
          backupDir = null;
        }
        if (kind === 'plugin') reloadPlugin(slug);
        else clearThemeCache();
      } catch { /* 回滚失败时保留现场供排查 */ }
      throw err;
    }

    // 清理备份（Windows 下可能句柄占用，用安全删除）
    if (backupDir) rmDirSafe(backupDir);

    console.log(`[Installer] ${kind} ${slug} v${manifest.version} ${upgraded ? '升级' : '安装'}成功`);
    revalidateSitePages();
    return { kind, slug, version: manifest.version, upgraded };
  } finally {
    if (backupDir && fs.existsSync(backupDir)) {
      rmDirSafe(backupDir);
    }
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
