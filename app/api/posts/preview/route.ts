// app/api/posts/preview/route.ts — Markdown 预览渲染（登录即可用）
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/api-auth';
import { renderMarkdown } from '@/lib/markdown/processor';

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = z.object({ content: z.string() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数校验失败' }, { status: 400 });
  }

  try {
    const html = await renderMarkdown(parsed.data.content);
    return NextResponse.json({ html });
  } catch (err) {
    console.error('[api/posts/preview] render failed:', err);
    return NextResponse.json({ error: '渲染失败' }, { status: 500 });
  }
}
