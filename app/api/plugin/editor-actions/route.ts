// app/api/plugin/editor-actions/route.ts — 编辑器工具按钮（editorCreate 扩展点）
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireSession();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const { collectEditorActions } = await import('@/lib/plugin/ui');
    const actions = await collectEditorActions(session.user.permissions);
    return NextResponse.json({ list: actions });
  } catch {
    return NextResponse.json({ list: [] });
  }
}
