// app/api/profile/route.ts — 当前登录用户资料（查看 / 更新 / 改密码）
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(30).optional(),
  // 用户可能没有邮箱 '' 视为不修改
  email: z.string().email('邮箱格式不正确').or(z.literal('')).optional().nullable(),
  bio: z.string().max(200).optional().nullable(),
  avatar: z.string().url('头像必须是图片链接').or(z.literal('')).optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, '新密码至少 6 位').max(72).optional(),
});

// GET 当前用户信息
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      bio: true,
      avatar: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      roles: { select: { role: { select: { displayName: true } } } },
    },
  });
  if (!user || user.status !== 'ENABLED') {
    return NextResponse.json({ error: '用户不存在或已禁用' }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    roles: user.roles.map((ur) => ur.role.displayName),
  });
}

// PATCH 更新资料 / 修改密码
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { displayName, email, bio, avatar, currentPassword, newPassword } = parsed.data;

  // 邮箱空值视为不修改（注册用户可能没有邮箱）
  const emailInput = email === '' || email === null ? undefined : email;
  const avatarInput = avatar === '' ? null : avatar;

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.status !== 'ENABLED') {
    return NextResponse.json({ error: '用户不存在或已禁用' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (displayName !== undefined) data.displayName = displayName;
  if (bio !== undefined) data.bio = bio;
  if (avatarInput !== undefined) data.avatar = avatarInput;

  // 改邮箱：校验唯一
  if (emailInput !== undefined && emailInput !== user.email) {
    const taken = await db.user.findUnique({ where: { email: emailInput }, select: { id: true } });
    if (taken) return NextResponse.json({ error: '邮箱已被其他账号使用' }, { status: 409 });
    data.email = emailInput;
  }

  // 改密码：必须验证旧密码
  if (newPassword) {
    const valid = await bcrypt.compare(currentPassword || '', user.passwordHash || '');
    if (!valid) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
