// app/api/pages/[id]/route.ts — 页面详情 / 更新 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) return NextResponse.json({ error: '页面不存在' }, { status: 404 });
  return NextResponse.json(page);
}

const putSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  summary: z.string().max(1000).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  order: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('page:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '页面不存在' }, { status: 404 });

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

  try {
    const page = await db.page.update({ where: { id }, data: parsed.data });
    revalidatePath('/', 'layout');
    return NextResponse.json(page);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Slug 已存在，请更换' }, { status: 400 });
    }
    console.error('[api/pages/id] update failed:', err);
    return NextResponse.json({ error: '更新页面失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('page:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '页面不存在' }, { status: 404 });

  await db.page.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
