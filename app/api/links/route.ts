// app/api/links/route.ts — 友链列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, requirePermission } from '@/lib/api-auth';
import { pluginApiGate } from '@/lib/plugin/api-gate';
import { db } from '@/lib/prisma';

// 列表（未登录只看已发布）
export async function GET() {
  const session = await requireSession();
  const list = await db.link.findMany({
    where: session ? {} : { status: 'PUBLISHED' },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({ list });
}

const createSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  url: z.string().min(1, 'URL 不能为空'),
  logo: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  order: z.number().int().optional(),
  status: z.enum(['PUBLISHED', 'HIDDEN']).optional(),
});

export async function POST(req: NextRequest) {
  const blocked = await pluginApiGate(req);
  if (blocked) return blocked;
  const check = await requirePermission('link:create');
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

  const link = await db.link.create({ data: parsed.data });
  revalidatePath('/', 'layout');
  return NextResponse.json(link, { status: 201 });
}
