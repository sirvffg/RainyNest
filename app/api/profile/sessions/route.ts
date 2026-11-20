// app/api/profile/sessions/route.ts — 当前用户的登录设备（查看 / 下线）
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { listSessions, revokeAllSessions, revokeSession } from '@/lib/session-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 查看自己的登录设备（标记当前设备）
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const currentToken = session.user.sessionToken;
  const list = await listSessions(session.user.id, currentToken);
  return NextResponse.json({ list });
}

// 下线指定设备；不传 sessionId 则下线除当前设备外的全部设备
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sessionId =
    (body && typeof body.sessionId === 'string' ? body.sessionId : '') ||
    req.nextUrl.searchParams.get('sessionId') ||
    '';
  const currentToken = session.user.sessionToken;

  if (sessionId) {
    const revoked = await revokeSession(session.user.id, sessionId);
    if (revoked === 0) {
      return NextResponse.json({ error: '设备不存在或已下线' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, revoked });
  }

  // 未指定设备：保留当前设备，下线其他所有设备
  const revoked = await revokeAllSessions(session.user.id, currentToken);
  return NextResponse.json({ ok: true, revoked });
}
