// app/api/auth/email-code/route.ts — 发送邮箱验证码（登录用）
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/prisma';
import { sendVerificationCode } from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email('邮箱格式不正确').max(100),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const email = parsed.data.email.trim();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, lockedUntil: true },
  });
  if (!user) {
    return NextResponse.json({ error: '该邮箱尚未注册，请先注册账号' }, { status: 404 });
  }
  if (user.status !== 'ENABLED') {
    return NextResponse.json({ error: '账号已被禁用，无法登录' }, { status: 403 });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: '账号已被锁定，请稍后再试' }, { status: 403 });
  }

  try {
    const result = await sendVerificationCode({ target: email, channel: 'EMAIL', purpose: 'LOGIN' });
    return NextResponse.json({ ok: true, expiresIn: result.expiresIn });
  } catch (err) {
    const message = err instanceof Error ? err.message : '验证码发送失败';
    // 60 秒限频返回 429，便于前端区分
    const status = message.includes('频繁') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
