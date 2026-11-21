// app/(site)/t/[...path]/page.tsx — 主题自定义路由挂载点（/t/<path>）
// 激活主题在 theme.json 的 routes 声明 + templates/routes/<path>.tsx 模板；
// 前台导航由管理员在后台菜单管理手动添加 /t/<path>（对齐 Halo：菜单不自动注入）。
import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';
import type { Metadata } from 'next';
import { getSiteSetting } from '@/lib/site';
import { getActiveTheme, getThemeRoutes } from '@/lib/theme';
import { resolveThemeRouteTemplate, type TemplateSite } from '@/lib/theme/templates';

type PageProps = { params: Promise<{ path: string[] }> };

// /t/<path> 仅支持单段路径，与注册表 key（文件名）一致
function getRoutePath(params: PageProps['params']) {
  return params.then((p) => (p.path?.length === 1 ? p.path[0] : null));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const routePath = await getRoutePath(params);
  if (!routePath) return {};
  const routes = await getThemeRoutes();
  const def = routes.find((r) => r.path === routePath);
  if (!def) return {};
  return { title: def.title };
}

export default async function ThemeRoutePage({ params }: PageProps) {
  const routePath = await getRoutePath(params);
  if (!routePath) notFound();

  const [theme, routes, site] = await Promise.all([getActiveTheme(), getThemeRoutes(), getSiteSetting()]);
  if (!theme) notFound();
  if (!routes.some((r) => r.path === routePath)) notFound();

  let mod: Awaited<ReturnType<typeof resolveThemeRouteTemplate>> = null;
  try {
    mod = await resolveThemeRouteTemplate(routePath);
  } catch (err) {
    console.error(`[Theme] 路由模板 /t/${routePath} 加载失败:`, err);
    notFound();
  }
  if (!mod) notFound();

  const templateSite: TemplateSite = {
    title: site.title,
    subtitle: site.subtitle ?? null,
    description: site.description ?? null,
    logo: site.logo ?? null,
    url: site.url ?? null,
    footerText: site.footerText ?? null,
    icp: site.icp ?? null,
  };

  const Comp = mod.default as ComponentType<{ site: TemplateSite; config: Record<string, any> }>;
  return <Comp site={templateSite} config={theme.config ?? {}} />;
}
