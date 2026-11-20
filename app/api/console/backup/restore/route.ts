// app/api/console/backup/restore/route.ts — 从 .db / 备份 zip 恢复（仅管理员）
import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/api-auth';
import { restoreFromUpload } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 备份包最大体积：200MB
const MAX_SIZE = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const perms = session.user.permissions || [];
  if (!perms.includes('*')) {
    return NextResponse.json({ error: '只有管理员可以恢复备份' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '请求体不是合法的 multipart 表单' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 file 字段' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '备份文件超过 200MB 上限' }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await restoreFromUpload(buffer, file.name || '');

    // 恢复后刷新前台缓存
    try {
      revalidatePath('/', 'layout');
    } catch { /* 非请求上下文忽略 */ }

    return NextResponse.json({
      ok: true,
      ...result,
      restartRequired: true,
      message: '数据库已恢复，建议重启服务以确保所有连接使用新库',
    });
  } catch (err) {
    console.error('[api/console/backup/restore] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '恢复失败' },
      { status: 400 }
    );
  }
}
