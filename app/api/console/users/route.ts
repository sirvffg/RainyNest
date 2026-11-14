// app/api/console/users/route.ts — 用户列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';

// 用户列表（含角色摘要）
export async function GET() {
  const check = await requirePermission('user:list');
  if (check) return check;

  const [list, allRoles] = await Promise.all([
    db.user.findMany({
      include: { roles: { include: { role: { select: { id: true, name: true, displayName: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.role.findMany({ select: { id: true, name: true, displayName: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  return NextResponse.json({ list, roles: allRoles });
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
      include: { roles: { include: { role: { select: { id: true, name: true, displayName: true } } } } },
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
