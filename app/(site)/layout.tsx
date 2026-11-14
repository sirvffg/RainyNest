// app/(site)/layout.tsx — 前台布局：Header + Main + Sidebar + Footer（含插件 injectFooter 注入）
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Sidebar from '@/components/layout/Sidebar';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import { collectInjectFooter } from '@/lib/plugin/ui';
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

  return (
    <div className="flex flex-col min-h-screen">
      <Header siteTitle={site.title} menus={menus} />
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-10">
          <main className="min-w-0 flex-1">{children}</main>
          <Sidebar />
        </div>
      </div>
      <Footer />
      {footerNodes.map((node, i) =>
        typeof node === 'string' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: node }} />
        ) : (
          <div key={i}>{node}</div>
        ),
      )}
    </div>
  );
}
