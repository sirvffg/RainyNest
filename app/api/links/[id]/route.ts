// app/api/links/[id]/route.ts — 友链更新 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

const putSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).optional(),
  logo: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  order: z.number().int().optional(),
  status: z.enum(['PUBLISHED', 'HIDDEN']).optional(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('link:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.link.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '友链不存在' }, { status: 404 });

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

  const link = await db.link.update({ where: { id }, data: parsed.data });
  revalidatePath('/', 'layout');
  return NextResponse.json(link);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('link:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.link.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '友链不存在' }, { status: 404 });

  await db.link.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
