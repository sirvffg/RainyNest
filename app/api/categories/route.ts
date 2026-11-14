// app/api/categories/route.ts — 分类列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

export async function GET() {
  const list = await db.category.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ list });
}

const createSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  slug: z.string().min(1, 'Slug 不能为空').max(100),
  description: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const check = await requirePermission('category:create');
  if (check) return check;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }

  try {
    const category = await db.category.create({ data: parsed.data });
    revalidatePath('/', 'layout');
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: '名称或 Slug 已存在' }, { status: 400 });
    }
    console.error('[api/categories] create failed:', err);
    return NextResponse.json({ error: '创建分类失败' }, { status: 500 });
  }
}
