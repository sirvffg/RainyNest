// app/api/auth/register/route.ts — 用户注册
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  username: z
    .string()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最长 20 个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母 数字 下划线 连字符'),
  email: z.string().email('邮箱格式不正确').max(100),
  displayName: z.string().trim().min(1, '昵称不能为空').max(30).optional(),
  password: z.string().min(6, '密码至少 6 位').max(72),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { username, email, password } = parsed.data;
  const displayName = parsed.data.displayName?.trim() || username;

  const exists = await db.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (exists) {
    const msg = exists.username === username ? '用户名已被占用' : '邮箱已被注册';
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const viewerRole = await db.role.findUnique({ where: { name: 'viewer' } });
  if (!viewerRole) {
    return NextResponse.json({ error: '系统未初始化 请联系管理员' }, { status: 500 });
  }

  const user = await db.user.create({
    data: {
      username,
      email,
      displayName,
      passwordHash: await bcrypt.hash(password, 10),
      status: 'ENABLED',
      roles: { create: [{ roleId: viewerRole.id }] },
    },
    select: { id: true, username: true },
  });

  return NextResponse.json({ ok: true, id: user.id, username: user.username }, { status: 201 });
}
