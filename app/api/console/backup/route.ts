// app/api/console/backup/route.ts — 备份管理（列表 / 创建 / 删除 / 下载）
import { NextResponse, NextRequest } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { createBackup, deleteBackup, listBackups, zipBackup } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 仅超级管理员（permissions 含 '*'）可操作备份
async function requireAdmin() {
  const session = await requireSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }
  const perms = session.user.permissions || [];
  if (!perms.includes('*')) {
    return { error: NextResponse.json({ error: '只有管理员可以操作备份' }, { status: 403 }) };
  }
  return { session };
}

// GET：无 name → 备份列表；带 name → 下载该备份（zip）
export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const name = req.nextUrl.searchParams.get('name');
  if (name) {
    try {
      const buffer = await zipBackup(name);
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="rainynest-backup-${name}.zip"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch (err) {
      console.error('[api/console/backup] download failed:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : '备份下载失败' },
        { status: 404 }
      );
    }
  }

  try {
    const backups = await listBackups();
    // 插件扩展点：backupTab / backupListItemOperation（按当前用户权限过滤）
    let tabs: unknown[] = [];
    let operations: unknown[] = [];
    const permissions = check.session?.user?.permissions;
    try {
      const { collectTabs, collectListOperations } = await import('@/lib/plugin/ui');
      [tabs, operations] = await Promise.all([
        collectTabs('backupTab', permissions),
        collectListOperations('backupListItemOperation', permissions),
      ]);
    } catch { /* 插件系统未就绪 */ }
    return NextResponse.json({ backups, tabs, operations });
  } catch (err) {
    console.error('[api/console/backup] list failed:', err);
    return NextResponse.json({ error: '读取备份列表失败' }, { status: 500 });
  }
}

// POST：创建备份（默认手动）
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  let type: 'manual' | 'auto' = 'manual';
  try {
    const body = await req.json();
    if (body?.type === 'auto') type = 'auto';
  } catch {
    /* 无请求体时按手动备份处理 */
  }

  try {
    const meta = await createBackup({ type });
    return NextResponse.json({ ok: true, backup: meta });
  } catch (err) {
    console.error('[api/console/backup] create failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '备份创建失败' },
      { status: 500 }
    );
  }
}

// DELETE：?name= 删除单个备份
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const name = req.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: '缺少 name 参数' }, { status: 400 });
  }

  try {
    await deleteBackup(name);
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    console.error('[api/console/backup] delete failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '删除备份失败' },
      { status: 400 }
    );
  }
}
