// app/api/console/users/[id]/sessions/route.ts — 用户登录设备查看 / 下线
import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { listSessions, revokeAllSessions, revokeSession } from '@/lib/session-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// 查看指定用户的登录设备
export async function GET(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('user:list');
  if (check) return check;

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  const list = await listSessions(id);
  return NextResponse.json({ list });
}

// 下线指定会话（不传 sessionId 则下线该用户全部设备）
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('user:update');
  if (check) return check;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const sessionId =
    (body && typeof body.sessionId === 'string' ? body.sessionId : '') ||
    req.nextUrl.searchParams.get('sessionId') ||
    '';

  const revoked = sessionId ? await revokeSession(id, sessionId) : await revokeAllSessions(id);
  return NextResponse.json({ ok: true, revoked });
}
