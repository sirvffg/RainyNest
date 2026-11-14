// app/api/moments/[id]/route.ts — 说说更新 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

const putSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  images: z.array(z.string()).max(9).optional(),
  status: z.enum(['PUBLISHED', 'DRAFT']).optional(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('moment:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.moment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '说说不存在' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    content: parsed.data.content ?? existing.content,
    status: parsed.data.status ?? existing.status,
  };
  if (parsed.data.images !== undefined) {
    data.images = parsed.data.images.length > 0 ? JSON.stringify(parsed.data.images) : null;
  }

  const moment = await db.moment.update({
    where: { id },
    data,
    include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
  });
  revalidatePath('/', 'layout');
  return NextResponse.json(moment);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('moment:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.moment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '说说不存在' }, { status: 404 });

  await db.moment.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
