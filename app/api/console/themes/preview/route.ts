// app/api/console/themes/preview/route.ts — 主题在线预览（写入 1 小时 httpOnly cookie）
// GET ?slug=xxx 开启预览；DELETE 退出预览。前台主进程读取 cookie 后按 slug 渲染主题
import { NextResponse, NextRequest } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { getThemeBySlug } from '@/lib/theme';

export const runtime = 'nodejs';

const PREVIEW_COOKIE = 'rn_theme_preview';
const PREVIEW_MAX_AGE = 3600; // 1 小时

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const slug = (req.nextUrl.searchParams.get('slug') ?? '').trim();
  if (!slug) {
    return NextResponse.json({ error: '缺少 slug 参数' }, { status: 400 });
  }

  const theme = await getThemeBySlug(slug);
  if (!theme) {
    return NextResponse.json({ error: '主题不存在或 theme.json 缺失' }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, slug, name: theme.name });
  res.cookies.set(PREVIEW_COOKIE, slug, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: PREVIEW_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PREVIEW_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
