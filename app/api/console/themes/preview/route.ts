// app/api/console/themes/preview/route.ts — 主题在线预览入口
// GET ?slug=xxx 校验主题存在后返回预览地址；预览由独立路由 /preview?theme=slug 渲染，
// 不写 cookie，避免让整站因 cookie 变成动态渲染而失去 ISR。
import { NextResponse, NextRequest } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { getThemeBySlug } from '@/lib/theme';

export const runtime = 'nodejs';

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

  return NextResponse.json({
    ok: true,
    slug,
    name: theme.name,
    previewUrl: `/preview?theme=${encodeURIComponent(slug)}`,
  });
}
