// lib/api-auth.ts — API 路由鉴权辅助（session / 权限检查）
// 用法：const check = await requirePermission('post:create'); if (check) return check;
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';

// 获取当前 session（未登录返回 null）
export async function requireSession(): Promise<Session | null> {
  return await auth();
}

// 判断 session 是否拥有某权限（超级管理员 permissions 含 '*' 直接放行）
export function hasPermission(session: Session | null | undefined, name: string): boolean {
  const perms = session?.user?.permissions;
  if (!perms || !Array.isArray(perms)) return false;
  return perms.includes('*') || perms.includes(name);
}

// 要求登录 + 指定权限；通过返回 null，否则返回错误 Response
export async function requirePermission(name: string): Promise<Response | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (!hasPermission(session, name)) {
    return NextResponse.json({ error: '没有执行此操作的权限' }, { status: 403 });
  }
  return null;
}

// 中文/英文通用 slug：非 ASCII 直接用原字符串（SQLite 唯一索引支持）
export function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return s || input.trim() || `tag-${Date.now()}`;
}
