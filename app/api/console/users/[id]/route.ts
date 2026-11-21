// app/api/console/users/[id]/route.ts — 用户更新 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

type Ctx = { params: Promise<{ id: string }> };

// 用户白名单字段：绝不返回 passwordHash / token / extra 等敏感字段
const userSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  avatar: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  roles: {
    select: {
      userId: true,
      roleId: true,
      role: { select: { id: true, name: true, displayName: true } },
    },
  },
} as const;

const putSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  // 注册用户可能没有邮箱 '' / null 视为不修改
  email: z.string().email('邮箱格式不正确').or(z.literal('')).optional().nullable(),
  status: z.enum(['ENABLED', 'DISABLED', 'LOCKED']).optional(),
  password: z.string().min(6, '密码至少 6 位').max(100).optional().nullable(),
  roleIds: z.array(z.string()).optional(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  // 改角色需要 user:assign-role；其他字段需要 user:update；重置密码需要 user:reset-password
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
  const input = parsed.data;

  const perms = session.user.permissions || [];
  const isSuper = perms.includes('*');
  const baseOk = isSuper || perms.includes('user:update');
  if (!baseOk) {
    return NextResponse.json({ error: '没有执行此操作的权限' }, { status: 403 });
  }
  if (input.password !== undefined && input.password !== null && !isSuper && !perms.includes('user:reset-password')) {
    return NextResponse.json({ error: '没有重置密码的权限' }, { status: 403 });
  }
  if (input.roleIds !== undefined && !isSuper && !perms.includes('user:assign-role')) {
    return NextResponse.json({ error: '没有分配角色的权限' }, { status: 403 });
  }

  // 邮箱空值（'' / null）统一视为不修改 注册用户可能没有邮箱
  if (input.email === '' || input.email === null) {
    delete input.email;
  }

  const { id } = await params;
  const existing = await db.user.findUnique({
    where: { id },
    select: { displayName: true, email: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  const data: Record<string, unknown> = {
    displayName: input.displayName ?? existing.displayName,
    email: input.email ?? existing.email,
    status: input.status ?? existing.status,
  };
  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  try {
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        select: userSelect,
      });
      // 角色整体替换
      if (input.roleIds !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (input.roleIds.length > 0) {
          await tx.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: id, roleId })) });
        }
      }
      return updated;
    });
    return NextResponse.json(user);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: '邮箱已被其他用户使用' }, { status: 400 });
    }
    console.error('[api/console/users/id] update failed:', err);
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('user:delete');
  if (check) return check;

  const session = await auth();
  const { id } = await params;
  if (session?.user?.id && session.user.id === id) {
    return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
  }

  const existing = await db.user.findUnique({
    where: { id },
    select: { roles: { select: { role: { select: { name: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  // 不能删除最后一个管理员
  const isAdmin = existing.roles.some((ur) => ur.role.name === 'administrator');
  if (isAdmin) {
    const adminCount = await db.user.count({
      where: { roles: { some: { role: { name: 'administrator' } } } },
    });
    if (adminCount <= 1) {
      return NextResponse.json({ error: '不能删除最后一个管理员账号' }, { status: 400 });
    }
  }

  await db.user.delete({ where: { id } }); // sessions/posts/comments 等按 onDelete 策略处理
  return NextResponse.json({ ok: true });
}
