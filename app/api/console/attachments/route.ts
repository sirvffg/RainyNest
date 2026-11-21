// app/api/console/attachments/route.ts — 附件库：分页 / 搜索 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { requirePermission, requireSession } from '@/lib/api-auth';
import { db } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const check = await requirePermission('console:access');
  if (check) return check;
  const session = await requireSession();
  const permissions = session?.user?.permissions;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const size = Math.min(60, Math.max(1, Number(searchParams.get('size')) || 24));
  const q = (searchParams.get('q') || '').trim();

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { url: { contains: q } },
          { mimeType: { contains: q } },
        ],
      }
    : {};

  try {
    const [list, total] = await Promise.all([
      db.attachment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
        include: { uploader: { select: { displayName: true, username: true } } },
      }),
      db.attachment.count({ where }),
    ]);
    // 插件扩展点：附件选择器 Tab / 行操作（按当前用户权限过滤）
    let tabs: unknown[] = [];
    let operations: unknown[] = [];
    try {
      const { collectTabs, collectListOperations } = await import('@/lib/plugin/ui');
      [tabs, operations] = await Promise.all([
        collectTabs('attachmentSelectorTab', permissions),
        collectListOperations('attachmentListItemOperation', permissions),
      ]);
    } catch { /* 插件系统未就绪 */ }

    return NextResponse.json({ list, total, page, size, pages: Math.ceil(total / size), tabs, operations });
  } catch (err) {
    console.error('[api/console/attachments] failed:', err);
    return NextResponse.json({ error: '读取附件库失败' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const check = await requirePermission('photo:delete');
  if (check) return check;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) return NextResponse.json({ error: '附件不存在' }, { status: 404 });

  try {
    await db.attachment.delete({ where: { id } });
  } catch (err) {
    console.error('[api/console/attachments] delete failed:', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }

  // 本地存储的物理文件同步删除（插件存储不处理）
  if (attachment.storage === 'local' && attachment.url.startsWith('/uploads/')) {
    const filePath = path.join(process.cwd(), 'public', attachment.url.replace(/^\/+/, ''));
    try {
      await unlink(filePath);
    } catch { /* 文件可能已被移除 */ }
  }

  revalidatePath('/console/attachments');
  return NextResponse.json({ ok: true });
}
