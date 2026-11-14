// app/console/plugin-ext/[slug]/[[...path]]/page.tsx — 插件后台页面渲染（customAdminRoutes 扩展点）
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Puzzle } from 'lucide-react';
import { bootPlugins, getLoadedPlugins } from '@/lib/plugin/engine';

// Turbopack 禁止 RSC 静态 import react-dom/server → 运行时 require 绕过
const { renderToStaticMarkup } = process
  .getBuiltinModule('node:module')
  .createRequire(process.cwd() + '/package.json')('react-dom/server');

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string; path?: string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, path } = await params;
  await bootPlugins();
  const plugin = getLoadedPlugins().find((p) => p.slug === slug);
  const routePath = (path ?? []).join('/');
  const route = plugin?.handlers.customAdminRoutes?.find((r) => r.path === routePath);
  return { title: route?.title ?? (plugin?.meta.name ?? '插件') };
}

export default async function PluginAdminPage({ params }: Params) {
  const { slug, path } = await params;
  await bootPlugins();

  const plugin = getLoadedPlugins().find((p) => p.slug === slug);
  const routes = plugin?.handlers.customAdminRoutes ?? [];
  const routePath = (path ?? []).join('/');
  const route = routes.find((r) => r.path === routePath) ?? (routePath ? undefined : routes[0]);
  if (!plugin || !route) notFound();

  // 组件由插件预编译产物提供（nodeRequire 加载，不在 Next RSC 模块图内）
  // 因此用 renderToStaticMarkup 输出静态 HTML；交互通过原生 <form> 走插件 customApi
  const mod = await route.component();
  // 解包 CJS/ESM 互操作：ESM import CJS 时 mod.default = module.exports，组件在其 .default 上
  const modObj = mod as { default?: unknown };
  const inner = (modObj.default ?? mod) as unknown;
  const Comp =
    typeof inner === 'function'
      ? (inner as React.ComponentType)
      : ((inner as { default?: unknown }).default as React.ComponentType);
  const html = renderToStaticMarkup(<Comp />);

  return (
    <div className="space-y-5">
      <div className="anim-fade-in-down flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Puzzle className="h-5 w-5 text-primary" />
            {route.title}
          </h1>
          <p className="mt-1 text-xs text-fg-muted">
            来自插件 {plugin.meta.name}（{plugin.slug}）
          </p>
        </div>
        <Link
          href="/console/system/plugins"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-all duration-200 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          插件管理
        </Link>
      </div>

      <div
        className="anim-fade-in-up rounded-lg border border-line bg-bg p-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
