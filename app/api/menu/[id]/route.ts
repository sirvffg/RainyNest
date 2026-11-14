// app/api/menu/[id]/route.ts — 菜单更新 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

const putSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).optional(),
  icon: z.string().optional().nullable(),
  order: z.number().int().optional(),
  parentId: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('menu:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.menu.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '菜单不存在' }, { status: 404 });

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

  // 防止把菜单挂到自己/自己的子孙下
  if (parsed.data.parentId === id) {
    return NextResponse.json({ error: '父级菜单不能是自身' }, { status: 400 });
  }

  const menu = await db.menu.update({ where: { id }, data: parsed.data });
  revalidatePath('/', 'layout');
  return NextResponse.json(menu);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('menu:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.menu.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '菜单不存在' }, { status: 404 });

  // 有子菜单时先一并删除（两级菜单场景）
  await db.menu.deleteMany({ where: { parentId: id } });
  await db.menu.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
