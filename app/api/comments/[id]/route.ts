// app/api/comments/[id]/route.ts — 评论审核 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { hasPermission, requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { mailScenes } from '@/lib/mailer';

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

  // 首次审核通过时通知评论作者（fire-and-forget，SMTP 未配置时内部静默跳过）
  if (parsed.data.status === 'APPROVED' && existing.status !== 'APPROVED') {
    void (async () => {
      try {
        const detail = await db.comment.findUnique({
          where: { id },
          include: {
            user: { select: { email: true } },
            post: { select: { title: true } },
          },
        });
        if (detail?.user.email) {
          await mailScenes.commentApproved(detail.user.email, detail.post.title, detail.content);
        }
      } catch { /* 邮件失败不影响审核结果 */ }
    })();
  }

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
