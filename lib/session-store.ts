// lib/session-store.ts — 登录会话（设备）记录
// 仅在登录成功时写入 Session 表；JWT 回调只写一次，避免每次请求都落库
import { randomUUID } from 'node:crypto';
import { db } from './prisma';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/** 根据 UA 粗略识别设备类型（仅用于展示） */
function detectDevice(userAgent?: string | null): string {
  if (!userAgent) return '未知设备';
  const ua = userAgent.toLowerCase();
  const os = ua.includes('iphone') || ua.includes('ipad')
    ? 'iOS'
    : ua.includes('android')
      ? 'Android'
      : ua.includes('windows')
        ? 'Windows'
        : ua.includes('mac os')
          ? 'macOS'
          : ua.includes('linux')
            ? 'Linux'
            : '未知系统';
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/')
      ? 'Chrome'
      : ua.includes('firefox/')
        ? 'Firefox'
        : ua.includes('safari/')
          ? 'Safari'
          : '未知浏览器';
  return `${browser} · ${os}`;
}

/** 创建登录会话，返回 token（写入 JWT，用于标记当前设备） */
export async function createSession(options: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
  device?: string | null;
}): Promise<{ id: string; token: string }> {
  // 顺手清理该用户已过期的会话
  await db.session
    .deleteMany({ where: { userId: options.userId, expiresAt: { lt: new Date() } } })
    .catch(() => {});

  const token = randomUUID();
  const session = await db.session.create({
    data: {
      userId: options.userId,
      token,
      userAgent: options.userAgent?.slice(0, 500) ?? null,
      ip: options.ip?.slice(0, 100) ?? null,
      device: options.device ?? detectDevice(options.userAgent),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
    select: { id: true, token: true },
  });
  return session;
}

/** 刷新会话最后活跃时间 */
export async function touchSession(token: string): Promise<void> {
  if (!token) return;
  await db.session
    .updateMany({ where: { token, expiresAt: { gt: new Date() } }, data: { lastActiveAt: new Date() } })
    .catch(() => {});
}

/** 列出某用户仍然有效的登录设备（可通过 currentToken 标记当前设备，token 本身不返回） */
export async function listSessions(userId: string, currentToken?: string) {
  const rows = await db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      token: true,
      userAgent: true,
      ip: true,
      device: true,
      lastActiveAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return rows.map(({ token, ...rest }) => ({
    ...rest,
    current: !!currentToken && token === currentToken,
  }));
}

/** 下线单个会话（限定归属用户，避免越权） */
export async function revokeSession(userId: string, sessionId: string): Promise<number> {
  const result = await db.session.deleteMany({ where: { id: sessionId, userId } });
  return result.count;
}

/** 下线全部会话；可保留指定 token（例如当前设备） */
export async function revokeAllSessions(userId: string, exceptToken?: string): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      userId,
      ...(exceptToken ? { token: { not: exceptToken } } : {}),
    },
  });
  return result.count;
}
