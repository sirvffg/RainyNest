// app/api/console/cache/route.ts — 手动清缓存（站点设置 / 主题 / 插件）
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/api-auth';
import { clearSiteSettingCache } from '@/lib/site';
import { clearThemeCache } from '@/lib/theme';
import { resetPluginCache } from '@/lib/plugin/engine';

export const runtime = 'nodejs';

const bodySchema = z.object({
  type: z.enum(['site', 'theme', 'all']),
});

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'type 必须是 site / theme / all' }, { status: 400 });
  }

  const type = parsed.data.type;
  if (type === 'site' || type === 'all') clearSiteSettingCache();
  if (type === 'theme' || type === 'all') {
    clearThemeCache();
    resetPluginCache();
  }

  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, type });
}
