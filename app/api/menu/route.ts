// app/api/menu/route.ts — 菜单列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

// 列表（按 order 升序，平铺返回，含 parentId 供前端组树）
export async function GET() {
  const list = await db.menu.findMany({
    orderBy: { order: 'asc' },
    include: { children: { orderBy: { order: 'asc' } } },
  });
  // 只返回顶级 + children 嵌套结构（顶级菜单自身 parentId 为空）
  const topLevel = list.filter((m) => !m.parentId);
  return NextResponse.json({ list: topLevel });
}

const createSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  url: z.string().min(1, 'URL 不能为空'),
  icon: z.string().optional().nullable(),
  order: z.number().int().optional(),
  parentId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const check = await requirePermission('menu:create');
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

  const menu = await db.menu.create({ data: parsed.data });
  revalidatePath('/', 'layout');
  return NextResponse.json(menu, { status: 201 });
}
