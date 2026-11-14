// app/(site)/p/[...path]/page.tsx — 插件自定义前台路由（customFrontendRoutes 扩展点）
// 匹配插件注册的 FrontendRouteDef 并渲染其组件，无匹配时 404
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPluginFrontendRoutes } from '@/lib/plugin/engine';
import type { FrontendRouteDef } from '@/lib/plugin/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ path: string[] }>;
}

async function matchRoute(path: string[]): Promise<(FrontendRouteDef & { pluginSlug: string }) | null> {
  const routes = await getPluginFrontendRoutes();
  const joined = path.join('/');
  return routes.find((r) => r.path.replace(/^\/+/, '') === joined) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  try {
    const def = await matchRoute(path);
    return { title: def?.title ?? '页面' };
  } catch {
    return { title: '页面' };
  }
}

export default async function PluginFrontendPage({ params }: Props) {
  const { path } = await params;

  let def: (FrontendRouteDef & { pluginSlug: string }) | null = null;
  try {
    def = await matchRoute(path);
  } catch { /* 插件系统未就绪 */ }
  if (!def) notFound();

  // component 可能是异步加载器或同步组件
  let Comp: React.ComponentType;
  try {
    const ret = (def.component as () => unknown)();
    if (ret && typeof (ret as Promise<unknown>).then === 'function') {
      const mod = (await ret) as { default: React.ComponentType };
      Comp = mod.default;
    } else {
      Comp = def.component as unknown as React.ComponentType;
    }
  } catch {
    notFound();
  }

  return (
    <div className="anim-fade-in-up">
      <h1 className="text-2xl font-bold">{def.title}</h1>
      <div className="mt-6">
        <Comp />
      </div>
    </div>
  );
}
