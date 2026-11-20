// app/api/auth/reset-password/route.ts — 找回密码：校验验证码并重置密码
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/prisma';
import { verifyCode } from '@/lib/verification';
import { revokeAllSessions } from '@/lib/session-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email('邮箱格式不正确').max(100),
  code: z.string().regex(/^\d{6}$/, '验证码为 6 位数字'),
  password: z.string().min(6, '密码至少 6 位').max(72),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email: rawEmail, code, password } = parsed.data;
  const email = rawEmail.trim();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ error: '该邮箱尚未注册' }, { status: 404 });
  }
  if (user.status !== 'ENABLED') {
    return NextResponse.json({ error: '账号已被禁用，请联系管理员' }, { status: 403 });
  }

  const ok = await verifyCode({ target: email, channel: 'EMAIL', purpose: 'RESET', code });
  if (!ok) {
    return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10), loginFailCount: 0, lockedUntil: null },
  });

  // 密码已变更 → 吊销该用户全部登录会话
  await revokeAllSessions(user.id);

  return NextResponse.json({ ok: true });
}
