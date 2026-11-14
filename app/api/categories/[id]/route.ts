// app/api/categories/[id]/route.ts — 分类更新 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

const putSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('category:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '分类不存在' }, { status: 404 });

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
    const category = await db.category.update({ where: { id }, data: parsed.data });
    revalidatePath('/', 'layout');
    return NextResponse.json(category);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: '名称或 Slug 已存在' }, { status: 400 });
    }
    console.error('[api/categories/id] update failed:', err);
    return NextResponse.json({ error: '更新分类失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('category:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '分类不存在' }, { status: 404 });

  const postCount = await db.post.count({ where: { categoryId: id } });
  if (postCount > 0) {
    return NextResponse.json({ error: `该分类下仍有 ${postCount} 篇文章，无法删除` }, { status: 400 });
  }

  await db.category.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
