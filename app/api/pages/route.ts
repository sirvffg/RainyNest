// app/api/pages/route.ts — 页面列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';

export async function GET() {
  const session = await requireSession();
  // 未登录只能看已发布
  const list = await db.page.findMany({
    where: session ? {} : { status: 'PUBLISHED' },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({ list });
}

const createSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  slug: z.string().min(1, 'Slug 不能为空').max(200),
  content: z.string().min(1, '内容不能为空'),
  summary: z.string().max(1000).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  order: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const check = await requirePermission('page:create');
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
    const page = await db.page.create({ data: parsed.data });
    revalidatePath('/', 'layout');
    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Slug 已存在，请更换' }, { status: 400 });
    }
    console.error('[api/pages] create failed:', err);
    return NextResponse.json({ error: '创建页面失败' }, { status: 500 });
  }
}
