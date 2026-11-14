// app/api/comments/[id]/route.ts — 评论审核 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { hasPermission, requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

// 状态变更（需评论管理权限：通过/拒绝任一）
const putSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (!hasPermission(session, 'comment:approve') && !hasPermission(session, 'comment:reject')) {
    return NextResponse.json({ error: '没有执行此操作的权限' }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '评论不存在' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '状态值必须是 PENDING / APPROVED / REJECTED' }, { status: 400 });
  }

  const comment = await db.comment.update({ where: { id }, data: { status: parsed.data.status } });
  revalidatePath('/', 'layout');
  return NextResponse.json(comment);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('comment:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '评论不存在' }, { status: 404 });

  // 删除回复的评论（两级）
  await db.comment.deleteMany({ where: { parentId: id } });
  await db.comment.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
