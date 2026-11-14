// app/themes/[slug]/[...path]/route.ts — 主题静态资源动态服务
// 生产环境 next start 只在启动时扫描 public/，上传安装的主题静态文件放 public 会 404，
// 因此直接从 scripts/themes/<slug>/ 动态读取，URL 与 public 方案完全一致
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const THEMES_DIR = path.join(process.cwd(), 'scripts', 'themes');

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

type Ctx = { params: Promise<{ slug: string; path: string[] }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug, path: parts } = await params;

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return new NextResponse('Bad Request', { status: 400 });
  }
  const contentType = CONTENT_TYPES[path.extname(parts[parts.length - 1] || '').toLowerCase()];
  if (!contentType) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 路径拼接 + 越界防护
  const base = path.resolve(THEMES_DIR, slug);
  const file = path.resolve(base, ...parts);
  if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const body = fs.readFileSync(file);
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      // 主题静态资源随包更新，短缓存即可
      'Cache-Control': 'public, max-age=300',
    },
  });
}
