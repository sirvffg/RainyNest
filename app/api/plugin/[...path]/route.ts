// app/api/plugin/[...path]/route.ts — 插件 customApi 分发器
// 路由格式：/api/plugin/{plugin-slug}/{custom-path}，custom-path 与插件 customApi 定义的 path 匹配
import { NextResponse } from 'next/server';
import { bootPlugins, getLoadedPlugins } from '@/lib/plugin/engine';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ path: string[] }> };

async function dispatch(req: Request, { params }: Params): Promise<Response> {
  const { path: segments } = await params;
  if (!segments || segments.length < 1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [slug, ...rest] = segments;
  const subPath = '/' + rest.join('/');

  await bootPlugins();
  const plugin = getLoadedPlugins().find((p) => p.slug === slug);
  if (!plugin || !plugin.handlers.customApi) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const method = req.method as 'GET' | 'POST' | 'PUT' | 'DELETE';
  const def = plugin.handlers.customApi.find(
    (r) => r.method === method && (r.path === subPath || r.path.replace(/^\//, '') === rest.join('/'))
  );
  if (!def) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (def.auth) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    return await def.handler(req);
  } catch (err) {
    console.error(`[Plugin:${slug}] customApi ${method} ${subPath} failed:`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
