// app/api/console/backup/route.ts — 下载数据库备份（仅管理员）
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  // 仅超级管理员（permissions 含 '*'）可备份
  const perms = session.user.permissions || [];
  if (!perms.includes('*')) {
    return NextResponse.json({ error: '只有管理员可以创建备份' }, { status: 403 });
  }

  const dbPath = path.join(process.cwd(), 'db', 'blog.db');
  let buffer: Buffer;
  try {
    buffer = await readFile(dbPath);
  } catch (err) {
    console.error('[api/console/backup] read db failed:', err);
    return NextResponse.json({ error: '数据库文件不存在或不可读' }, { status: 500 });
  }

  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="rainynest-backup-${date}.db"`,
      'Content-Length': String(buffer.length),
    },
  });
}
