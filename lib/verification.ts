// lib/verification.ts — 邮箱/手机验证码签发与校验
// 规则：6 位数字、5 分钟有效、60 秒发送间隔、校验成功后一次性消费
import { randomInt } from 'node:crypto';
import { db } from './prisma';
import { getSiteSetting } from './site';
import { mailScenes } from './mailer';

export type VerificationChannel = 'EMAIL' | 'PHONE';
export type VerificationPurpose = 'LOGIN' | 'REGISTER' | 'RESET';

const CODE_TTL_MS = 5 * 60 * 1000; // 验证码有效期 5 分钟
const SEND_INTERVAL_MS = 60 * 1000; // 同一目标 60 秒内只能发送一次

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 生成 6 位数字验证码（保留前导 0） */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** 签发验证码并发送（目前仅实现邮箱通道） */
export async function sendVerificationCode(options: {
  target: string;
  channel?: VerificationChannel;
  purpose?: VerificationPurpose;
}): Promise<{ ok: true; expiresIn: number }> {
  const channel = options.channel ?? 'EMAIL';
  const purpose = options.purpose ?? 'LOGIN';
  const target = (options.target || '').trim();

  if (!target) {
    throw new Error('请填写接收验证码的邮箱');
  }
  if (channel === 'PHONE') {
    // 系统尚未接入短信服务商，给出明确错误而不是静默失败
    throw new Error('短信通道未配置，暂不支持手机验证码，请使用邮箱验证码');
  }
  if (!EMAIL_RE.test(target)) {
    throw new Error('邮箱格式不正确');
  }

  // 发送限频：同一邮箱 + 用途在 60 秒内只允许发送一次
  const last = await db.verificationCode.findFirst({
    where: { target, purpose },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (last) {
    const elapsed = Date.now() - last.createdAt.getTime();
    if (elapsed < SEND_INTERVAL_MS) {
      const wait = Math.ceil((SEND_INTERVAL_MS - elapsed) / 1000);
      throw new Error(`发送过于频繁，请 ${wait} 秒后再试`);
    }
  }

  // 顺手清理过期验证码，避免表无限增长
  await db.verificationCode.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

  const code = generateCode();
  const created = await db.verificationCode.create({
    data: {
      target,
      channel,
      purpose,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
    select: { id: true },
  });

  const site = await getSiteSetting();
  const result = await mailScenes.emailVerification(target, code, site.title || 'RainyNest');
  if (!result?.ok) {
    // 发送失败则删除记录，允许立即重新发送
    await db.verificationCode.delete({ where: { id: created.id } }).catch(() => {});
    throw new Error(result?.error ? `验证码邮件发送失败：${result.error}` : '验证码邮件发送失败，请检查 SMTP 配置');
  }

  return { ok: true, expiresIn: CODE_TTL_MS / 1000 };
}

/** 校验验证码；校验通过后立即标记为已使用（一次性消费） */
export async function verifyCode(options: {
  target: string;
  code: string;
  channel?: VerificationChannel;
  purpose?: VerificationPurpose;
}): Promise<boolean> {
  const channel = options.channel ?? 'EMAIL';
  const purpose = options.purpose ?? 'LOGIN';
  const target = (options.target || '').trim();
  const code = (options.code || '').trim();

  if (!target || !code) return false;

  const record = await db.verificationCode.findFirst({
    where: {
      target,
      channel,
      purpose,
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!record) return false;

  // updateMany + usedAt 为空的条件保证并发下也只消费一次
  const consumed = await db.verificationCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}
