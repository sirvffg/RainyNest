// app/(site)/layout.tsx — 前台布局：Header + Main + Sidebar + Footer
// 支持主题 layout 模板覆盖整体壳层；默认布局保持原结构。
import Header from '@/components/layout/Header';
import MermaidRenderer from '@/components/markdown/MermaidRenderer';
import Footer from '@/components/layout/Footer';
import Sidebar from '@/components/layout/Sidebar';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import { collectInjectFooter, collectHeaderActions } from '@/lib/plugin/ui';
import {
  resolveSystemTemplate,
  type LayoutTemplateProps,
  type TemplateSite,
} from '@/lib/theme/templates';
import type { NavItem } from '@/components/layout/Header';

export const revalidate = 3600;

export default async function WebLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteSetting();

  let menus: NavItem[] = [
    { name: '首页', url: '/' },
    { name: '博客', url: '/blog' },
    { name: '说说', url: '/moments' },
    { name: '友链', url: '/links' },
  ];
  try {
    const dbMenus = await db.menu.findMany({ orderBy: { order: 'asc' } });
    if (dbMenus.length > 0) {
      menus = dbMenus.map((m) => ({ name: m.name, url: m.url }));
    }
  } catch { /* 数据库未就绪用默认 */ }

  // 插件扩展点：injectFooter（页脚统计脚本 / 备案补充等）
  let footerNodes: Awaited<ReturnType<typeof collectInjectFooter>> = [];
  try {
    footerNodes = await collectInjectFooter();
  } catch { /* 插件系统未就绪 */ }

  // 插件扩展点：injectHeaderAction（顶栏按钮）
  let headerActions: Awaited<ReturnType<typeof collectHeaderActions>> = [];
  try {
    headerActions = await collectHeaderActions();
  } catch { /* 插件系统未就绪 */ }

  const header = <Header siteTitle={site.title} menus={menus} headerActions={headerActions} />;
  const sidebar = <Sidebar />;
  const footer = <Footer />;
  const footerContent = (
    <>
      {footerNodes.map((node, i) =>
        typeof node === 'string' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: node }} />
        ) : (
          <div key={i}>{node}</div>
        ),
      )}
    </>
  );

  const templateSite: TemplateSite = {
    title: site.title,
    subtitle: site.subtitle ?? null,
    description: site.description ?? null,
    logo: site.logo ?? null,
    url: site.url ?? null,
    footerText: site.footerText ?? null,
    icp: site.icp ?? null,
  };

  // 主题覆盖整体壳层：layout.tsx
  let LayoutOverride: Awaited<ReturnType<typeof resolveSystemTemplate<LayoutTemplateProps>>> = null;
  try {
    LayoutOverride = await resolveSystemTemplate<LayoutTemplateProps>('layout');
  } catch (err) {
    console.error('[Theme] layout 主题模板加载失败，回退默认布局:', err);
  }

  if (LayoutOverride) {
    const Template = LayoutOverride.default;
    return (
      <>
        <Template
          site={templateSite}
          menus={menus}
          header={header}
          sidebar={sidebar}
          footer={footer}
          footerNodes={footerContent}
        >
          {children}
        </Template>
        <MermaidRenderer />
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {header}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-10">
          <main className="min-w-0 flex-1">{children}</main>
          {sidebar}
        </div>
      </div>
      {footer}
      {footerContent}
      <MermaidRenderer />
    </div>
  );
}
