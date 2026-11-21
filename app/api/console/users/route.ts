// app/api/console/users/route.ts — 用户列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requirePermission, requireSession } from '@/lib/api-auth';
import { db } from '@/lib/prisma';

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

// 用户列表（含角色摘要）
export async function GET() {
  const check = await requirePermission('user:list');
  if (check) return check;
  const session = await requireSession();

  const [list, allRoles] = await Promise.all([
    db.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    }),
    db.role.findMany({ select: { id: true, name: true, displayName: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  // 插件扩展点：userDetailTab（按当前用户权限过滤）
  let tabs: unknown[] = [];
  try {
    const { collectTabs } = await import('@/lib/plugin/ui');
    tabs = await collectTabs('userDetailTab', session?.user?.permissions);
  } catch { /* 插件系统未就绪 */ }

  return NextResponse.json({ list, roles: allRoles, tabs });
}

// 创建用户（密码 bcrypt 哈希，可关联角色）
const createSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符').max(50),
  displayName: z.string().min(1, '昵称不能为空').max(100),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位').max(100),
  roleIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const check = await requirePermission('user:create');
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
  const { username, displayName, email, password, roleIds } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await db.user.create({
      data: {
        username,
        displayName,
        email,
        passwordHash,
        roles: { create: (roleIds || []).map((roleId) => ({ roleId })) },
      },
      select: userSelect,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: '用户名或邮箱已存在' }, { status: 400 });
    }
    console.error('[api/console/users] create failed:', err);
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
  }
}
