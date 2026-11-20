// app/api/console/themes/git-install/route.ts — 从 Git 仓库安装主题（仅管理员）
// 优先 git clone --depth 1；GitHub/Gitee 克隆失败时回退下载 codeload tar.gz（node:zlib 解包）
import { NextResponse, NextRequest } from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import { clearThemeCache } from '@/lib/theme';

export const runtime = 'nodejs';

const THEMES_DIR = path.join(process.cwd(), 'scripts', 'themes');
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const REF_RE = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;
const CLONE_TIMEOUT = 60_000;
const MAX_ARCHIVE_SIZE = 50 * 1024 * 1024;

interface GitInstallBody {
  repoUrl?: unknown;
  ref?: unknown;
}

export async function POST(req: NextRequest) {
  const check = await requirePermission('theme:install');
  if (check) return check;

  // 站点开关：允许 Git 安装主题
  const site = await getSiteSetting();
  if (!site.allowThemeGitInstall) {
    return NextResponse.json({ error: '站点已关闭 Git 安装主题' }, { status: 403 });
  }

  let body: GitInstallBody;
  try {
    body = (await req.json()) as GitInstallBody;
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const repoUrl = typeof body.repoUrl === 'string' ? body.repoUrl.trim() : '';
  const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
  if (!repoUrl || repoUrl.length > 500) {
    return NextResponse.json({ error: '缺少合法的 repoUrl' }, { status: 400 });
  }
  if (ref && (!REF_RE.test(ref) || ref.length > 200)) {
    return NextResponse.json({ error: 'ref 非法（仅允许字母数字 . _ - /）' }, { status: 400 });
  }

  // 仅允许 http(s)，拒绝 file/ssh/git@ 等本地或凭据协议
  let parsed: URL;
  try {
    parsed = new URL(repoUrl);
  } catch {
    return NextResponse.json({ error: 'repoUrl 不是合法 URL' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: '仅支持 http(s) 协议的仓库地址' }, { status: 400 });
  }
  if (/^(file|ssh|git):/i.test(repoUrl) || repoUrl.includes('git@')) {
    return NextResponse.json({ error: '不支持的仓库协议' }, { status: 400 });
  }

  const fallback = parseArchiveSource(parsed, ref);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-git-'));
  let backupDir: string | null = null;
  let destDir: string | null = null;

  try {
    // 1. 优先 git clone；失败时对 GitHub/Gitee 回退下载 tar.gz
    let sourceDir: string;
    let method: 'git' | 'tarball' = 'git';
    try {
      sourceDir = path.join(tmp, 'repo');
      await gitClone(repoUrl, ref, sourceDir);
    } catch (cloneErr) {
      if (!fallback) throw cloneErr;
      console.warn('[api/console/themes/git-install] git clone 失败，回退 tar.gz:', cloneErr instanceof Error ? cloneErr.message : cloneErr);
      method = 'tarball';
      sourceDir = path.join(tmp, 'archive');
      fs.mkdirSync(sourceDir, { recursive: true });
      await downloadAndExtract(fallback.url, sourceDir);
    }

    // 2. 定位 theme.json（仓库根目录或一层子目录）
    const themeRoot = findThemeRoot(sourceDir, 2);
    if (!themeRoot) throw new Error('仓库中未找到 theme.json');

    // 3. 校验清单与 slug（防路径穿越）
    const manifest = JSON.parse(fs.readFileSync(path.join(themeRoot, 'theme.json'), 'utf-8'));
    const slug = String(manifest.slug ?? '');
    if (!SLUG_RE.test(slug)) throw new Error(`slug 非法: ${slug || '(空)'}（需匹配 ^[a-z0-9][a-z0-9-]*$）`);
    if (!manifest.name || !manifest.version) throw new Error('theme.json 缺少 name / version');
    if (manifest.specVersion && manifest.specVersion !== '1.0') {
      throw new Error(`specVersion ${manifest.specVersion} 不受支持（需要 1.0）`);
    }

    destDir = path.resolve(THEMES_DIR, slug);
    if (destDir !== path.join(THEMES_DIR, slug)) throw new Error('非法主题目录');

    // 4. 已安装先备份，落盘失败自动回滚
    const existed = fs.existsSync(destDir);
    if (existed) {
      backupDir = `${destDir}.bak-${Date.now()}`;
      try {
        fs.renameSync(destDir, backupDir);
      } catch {
        // 同卷 rename 失败（Windows 句柄占用）→ 复制旧目录后删除
        copyDir(destDir, backupDir);
        fs.rmSync(destDir, { recursive: true, force: true });
      }
    }

    try {
      copyDir(themeRoot, destDir);

      // 5. 同步数据库记录
      await db.theme.upsert({
        where: { slug },
        update: {
          name: String(manifest.name),
          version: String(manifest.version),
          description: manifest.description ?? null,
          author: manifest.author ?? null,
          preview: manifest.preview ?? null,
          source: 'uploaded',
        },
        create: {
          slug,
          name: String(manifest.name),
          version: String(manifest.version),
          description: manifest.description ?? null,
          author: manifest.author ?? null,
          preview: manifest.preview ?? null,
          isActive: false,
          source: 'uploaded',
        },
      });
    } catch (err) {
      // 回滚：删除新目录并恢复备份
      try {
        fs.rmSync(destDir, { recursive: true, force: true });
        if (backupDir) {
          fs.renameSync(backupDir, destDir);
          backupDir = null;
        }
      } catch { /* 回滚失败时保留现场供排查 */ }
      throw err;
    }

    // 6. 清理备份与缓存
    if (backupDir) {
      try {
        fs.rmSync(backupDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // Windows 句柄占用时留待启动清扫
      }
      backupDir = null;
    }
    clearThemeCache();
    revalidatePath('/', 'layout');

    console.log(`[Theme] git 安装 ${slug} v${manifest.version} 成功（${method}）`);
    return NextResponse.json({
      ok: true,
      slug,
      name: manifest.name,
      version: manifest.version,
      upgraded: existed,
      method,
    });
  } catch (err) {
    console.error('[api/console/themes/git-install] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Git 安装主题失败' },
      { status: 400 }
    );
  } finally {
    // 回滚失败时保留 .bak 目录供人工恢复（列表扫描会跳过 .bak-<时间戳>）
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { /* 忽略 */ }
  }
}

// ── git clone（无 shell，60s 超时） ─────────────────────────────

function gitClone(repoUrl: string, ref: string, dest: string): Promise<void> {
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push('--', repoUrl, dest);

  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        timeout: CLONE_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
      (err, _stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || '').trim();
          reject(new Error(`git clone 失败: ${msg.slice(0, 500)}`));
          return;
        }
        resolve();
      }
    );
  });
}

// ── GitHub / Gitee 归档下载回退 ─────────────────────────────────

interface ArchiveSource {
  url: string;
}

function parseArchiveSource(url: URL, ref: string): ArchiveSource | null {
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!owner || !repo) return null;

  const encodedRef = (ref || '').split('/').map(encodeURIComponent).join('/');

  if (host === 'github.com' || host === 'www.github.com') {
    return { url: `https://codeload.github.com/${owner}/${repo}/tar.gz/${encodedRef || 'HEAD'}` };
  }
  if (host === 'gitee.com' || host === 'www.gitee.com') {
    return { url: `https://gitee.com/${owner}/${repo}/repository/archive/${encodedRef || 'master'}.tar.gz` };
  }
  return null;
}

async function downloadAndExtract(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(CLONE_TIMEOUT),
  });
  if (!res.ok) throw new Error(`下载主题归档失败（HTTP ${res.status}）`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ARCHIVE_SIZE) throw new Error(`主题归档超过 ${MAX_ARCHIVE_SIZE / 1024 / 1024}MB 上限`);

  extractTarGz(buf, dest);
}

// 简易 tar 解析（仅处理普通文件，跳过目录/链接/PAX 扩展头），解包时去掉归档顶层目录
function extractTarGz(buffer: Buffer, dest: string): void {
  let tar: Buffer;
  try {
    tar = zlib.gunzipSync(buffer, { maxOutputLength: 100 * 1024 * 1024 });
  } catch {
    throw new Error('主题归档解压失败（不是合法的 tar.gz）');
  }

  const root = path.resolve(dest);
  let offset = 0;

  const readString = (start: number, length: number) => {
    const slice = tar.subarray(start, start + length);
    const end = slice.indexOf(0);
    return slice.subarray(0, end === -1 ? slice.length : end).toString('utf8');
  };

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    // 连续两个全零块表示归档结束
    if (header.every((b) => b === 0)) break;

    const name = readString(0, 100);
    const size = parseInt(readString(124, 12).trim() || '0', 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const prefix = readString(345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;

    offset += 512;
    const contentEnd = offset + size;
    if (contentEnd > tar.length) throw new Error('主题归档已损坏');
    const content = tar.subarray(offset, contentEnd);
    offset += Math.ceil(size / 512) * 512;

    // 只落盘普通文件（'0' 或空），跳过目录/符号链接/PAX 头
    if (type !== '0' && type !== '\0') continue;
    if (fullName.endsWith('/')) continue;

    const normalized = path.posix.normalize(fullName).replace(/^\/+/, '');
    if (!normalized || normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
      throw new Error(`归档包含非法路径: ${fullName}`);
    }

    // 去掉 codeload 归档的顶层目录（<repo>-<ref>/ 或 <owner>/<repo>/...）
    const rel = normalized.split('/').slice(1).join('/');
    if (!rel) continue;

    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep)) throw new Error(`归档包含非法路径: ${fullName}`);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

// ── 目录工具 ───────────────────────────────────────────────────

// 在仓库中查找 theme.json（最多向下 depth 层）
function findThemeRoot(base: string, depth: number): string | null {
  if (fs.existsSync(path.join(base, 'theme.json'))) return base;
  if (depth <= 0) return null;

  let items: string[];
  try {
    items = fs.readdirSync(base);
  } catch {
    return null;
  }
  for (const item of items) {
    if (item === '.git' || item === 'node_modules') continue;
    const full = path.join(base, item);
    try {
      const st = fs.lstatSync(full);
      if (!st.isDirectory() || st.isSymbolicLink()) continue;
    } catch {
      continue;
    }
    const found = findThemeRoot(full, depth - 1);
    if (found) return found;
  }
  return null;
}

// 复制主题目录（跳过 .git 与符号链接，避免越界读取）
function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    if (item === '.git') continue;
    const s = path.join(src, item);
    const d = path.join(dest, item);
    const st = fs.lstatSync(s);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) copyDir(s, d);
    else if (st.isFile()) fs.copyFileSync(s, d);
  }
}
