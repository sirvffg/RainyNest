// app/api/console/roles/route.ts — 角色列表 / 创建
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 角色列表 + 全部权限（前端按 group 分组展示）
export async function GET() {
  const check = await requirePermission('role:list');
  if (check) return check;

  const [list, permissions] = await Promise.all([
    db.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.permission.findMany({ orderBy: [{ group: 'asc' }, { name: 'asc' }] }),
  ]);

  return NextResponse.json({ list, permissions });
}

const createSchema = z.object({
  name: z
    .string()
    .min(2, '角色标识至少 2 个字符')
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, '角色标识只能包含字母 数字 下划线 连字符'),
  displayName: z.string().trim().min(1, '角色名称不能为空').max(50),
  description: z.string().max(200).optional().nullable(),
  permissionIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const check = await requirePermission('role:create');
  if (check) return check;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }
  const { name, displayName, description, permissionIds } = parsed.data;

  // 只关联真实存在的权限，避免外键错误
  const validPermissions = permissionIds?.length
    ? await db.permission.findMany({ where: { id: { in: permissionIds } }, select: { id: true } })
    : [];

  try {
    const role = await db.role.create({
      data: {
        name,
        displayName,
        description: description || null,
        permissions: { create: validPermissions.map((p) => ({ permissionId: p.id })) },
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    return NextResponse.json(role, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: '角色标识已存在' }, { status: 400 });
    }
    console.error('[api/console/roles] create failed:', err);
    return NextResponse.json({ error: '创建角色失败' }, { status: 500 });
  }
}
