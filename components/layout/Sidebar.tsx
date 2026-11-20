// components/layout/Sidebar.tsx — 前台侧栏：最新文章 + 标签云 + 插件 widget（injectSidebarWidget 扩展点）
import Link from 'next/link';
import { Clock, Tag as TagIcon, Blocks } from 'lucide-react';
import { db } from '@/lib/prisma';
import { getPluginSidebarWidgets } from '@/lib/plugin/engine';
import type { SidebarWidgetDef } from '@/lib/plugin/types';
import SidebarPluginWidgets from './SidebarPluginWidgets';

interface PostItem {
  title: string;
  slug: string;
  createdAt: Date;
}

interface TagItem {
  name: string;
  slug: string;
  count?: number;
}

// 插件 widget 渲染：component 可能是同步组件或异步加载器
async function PluginWidget({ def }: { def: SidebarWidgetDef }) {
  try {
    const comp = def.component as () => unknown;
    const ret = comp();
    let Comp: React.ComponentType;
    if (ret && typeof (ret as Promise<unknown>).then === 'function') {
      const mod = (await ret) as { default: React.ComponentType };
      Comp = mod.default;
    } else {
      Comp = def.component as React.ComponentType;
    }
    return (
      <section className="anim-fade-in-up rounded-xl border border-line bg-bg p-4">
        {def.title && (
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Blocks className="h-4 w-4 text-primary" />
            {def.title}
          </h3>
        )}
        <Comp />
      </section>
    );
  } catch {
    return null; // widget 渲染失败不影响页面
  }
}

export default async function Sidebar() {
  let posts: PostItem[] = [];
  let tags: TagItem[] = [];
  let widgets: SidebarWidgetDef[] = [];

  try {
    posts = await db.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, slug: true, createdAt: true },
    });
  } catch { /* 数据库未就绪 */ }

  try {
    const [tagRows, postTagCounts] = await Promise.all([
      db.tag.findMany({
        take: 12,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
      db.postTag.groupBy({ by: ['tagId'], _count: { tagId: true } }),
    ]);
    const countMap = new Map(postTagCounts.map((c) => [c.tagId, c._count.tagId]));
    tags = tagRows.map((t) => ({ name: t.name, slug: t.slug, count: countMap.get(t.id) ?? 0 }));
  } catch { /* 数据库未就绪 */ }

  try {
    widgets = await getPluginSidebarWidgets();
  } catch { /* 插件系统未就绪 */ }

  return (
    <aside data-site-sidebar className="sticky top-20 hidden w-60 shrink-0 flex-col gap-6 self-start xl:flex">
      {/* 最新文章 */}
      {posts.length > 0 && (
        <section className="anim-fade-in-up rounded-xl border border-line bg-bg p-4">
          <h3 className="mb-3 text-sm font-semibold">最新文章</h3>
          <ul className="space-y-3">
            {posts.map((p, i) => (
              <li key={p.slug} className="anim-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="block text-sm leading-snug text-fg-muted transition-all duration-200 hover:text-primary hover:translate-x-0.5"
                >
                  <span className="line-clamp-2">{p.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-fg-muted/70">
                    <Clock className="h-3 w-3" />
                    {p.createdAt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 标签云 */}
      {tags.length > 0 && (
        <section className="anim-fade-in-up rounded-xl border border-line bg-bg p-4" style={{ animationDelay: '0.08s' }}>
          <h3 className="mb-3 text-sm font-semibold">标签云</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link
                key={t.slug}
                href={`/tags/${t.slug}`}
                className="inline-flex items-center gap-1 rounded-full bg-bg-secondary px-2.5 py-1 text-xs text-fg-muted transition-all duration-200 hover:bg-primary hover:text-white active:scale-95"
              >
                <TagIcon className="h-3 w-3" />
                {t.name}
                <span className="text-[10px] opacity-70">{t.count ?? 0}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 插件 widget */}
      {widgets.map((def, i) => (
        <PluginWidget key={i} def={def} />
      ))}

      {/* 插件 widget 数据填充（客户端扫描 data-widget-api 容器） */}
      <SidebarPluginWidgets />
    </aside>
  );
}
