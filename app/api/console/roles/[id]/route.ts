// app/api/console/roles/[id]/route.ts — 角色更新 / 删除
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z
    .string()
    .min(2, '角色标识至少 2 个字符')
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, '角色标识只能包含字母 数字 下划线 连字符')
    .optional(),
  displayName: z.string().trim().min(1, '角色名称不能为空').max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  permissionIds: z.array(z.string()).optional(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('role:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.role.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '角色不存在' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }
  const input = parsed.data;

  // 内置角色：禁止改标识与权限，避免破坏后台鉴权
  if (existing.builtIn && input.name !== undefined && input.name !== existing.name) {
    return NextResponse.json({ error: '内置角色的标识不可修改' }, { status: 400 });
  }
  if (existing.builtIn && input.permissionIds !== undefined) {
    return NextResponse.json({ error: '内置角色的权限不可修改' }, { status: 400 });
  }

  const validPermissions = input.permissionIds?.length
    ? await db.permission.findMany({ where: { id: { in: input.permissionIds } }, select: { id: true } })
    : [];

  try {
    const role = await db.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
        },
      });

      if (input.permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (validPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: validPermissions.map((p) => ({ roleId: id, permissionId: p.id })),
          });
        }
      }

      return tx.role.findUnique({
        where: { id: updated.id },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      });
    });

    return NextResponse.json(role);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: '角色标识已存在' }, { status: 400 });
    }
    console.error('[api/console/roles/id] update failed:', err);
    return NextResponse.json({ error: '更新角色失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('role:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  if (existing.builtIn) {
    return NextResponse.json({ error: '内置角色不可删除' }, { status: 400 });
  }
  if (existing._count.users > 0) {
    return NextResponse.json({ error: '该角色下仍有用户，请先解除分配' }, { status: 400 });
  }

  await db.role.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
