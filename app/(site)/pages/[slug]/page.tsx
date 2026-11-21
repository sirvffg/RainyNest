// app/pages/[slug]/page.tsx — 独立页面（Markdown 渲染 + 可选侧边栏 + 插件文末块）
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { db } from '@/lib/prisma';
import { collectSinglePageContentHtml } from '@/lib/plugin/ui';
import { renderMarkdown } from '@/lib/markdown/processor';
import { resolveSystemTemplate, type PageTemplateProps } from '@/lib/theme/templates';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';

export const revalidate = 600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const page = await db.page.findUnique({ where: { slug } });
    if (!page) return { title: '页面不存在' };
    return {
      title: page.title,
      description: page.summary || undefined,
      openGraph: { title: page.title, description: page.summary || undefined },
    };
  } catch {
    return { title: '页面' };
  }
}

export default async function CustomPage({ params }: Props) {
  const { slug } = await params;

  let page: {
    title: string;
    summary: string | null;
    content: string;
    status: string;
    showSidebar: boolean;
    sidebarContent: string | null;
  } | null = null;
  try {
    page = await db.page.findUnique({
      where: { slug },
      select: {
        title: true,
        summary: true,
        content: true,
        status: true,
        showSidebar: true,
        sidebarContent: true,
      },
    });
  } catch { /* 数据库未就绪 */ }

  if (!page || page.status !== 'PUBLISHED') notFound();

  // 插件扩展点：独立页面正文底部追加块
  let contentBlocks: string[] = [];
  try {
    contentBlocks = await collectSinglePageContentHtml();
  } catch { /* 插件系统未就绪 */ }

  const customSidebar = page.sidebarContent?.trim() ? page.sidebarContent : null;
  // 全宽或使用自定义侧边栏时，隐藏全局默认侧栏
  const hideSiteSidebar = !page.showSidebar || !!customSidebar;
  const twoColumn = page.showSidebar && !!customSidebar;

  // 正文与自定义侧边栏统一走 Markdown 管线，渲染结果同时供默认分支与主题模板复用
  const html = await renderMarkdown(page.content);
  const sidebarHtml = customSidebar ? await renderMarkdown(customSidebar) : null;

  const contentBlocksNode =
    contentBlocks.length > 0 ? (
      <div className="mt-8 space-y-4">
        {contentBlocks.map((block, i) => (
          <div
            key={i}
            className="anim-fade-in"
            style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            dangerouslySetInnerHTML={{ __html: block }}
          />
        ))}
      </div>
    ) : null;

  let Override: Awaited<ReturnType<typeof resolveSystemTemplate<PageTemplateProps>>> = null;
  try {
    Override = await resolveSystemTemplate<PageTemplateProps>('page');
  } catch (err) {
    console.error('[Theme] page 模板加载失败，回退内置模板:', err);
  }

  if (Override) {
    const Template = Override.default;
    return (
      <Template
        page={{
          title: page.title,
          summary: page.summary,
          html,
          sidebarHtml,
          showSidebar: page.showSidebar,
        }}
        slots={{ contentBlocks: contentBlocksNode }}
      />
    );
  }

  return (
    <div className={twoColumn ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-10' : ''}>
      {hideSiteSidebar && (
        <style
          dangerouslySetInnerHTML={{
            __html: '@media (min-width:1280px){[data-site-sidebar]{display:none!important}}',
          }}
        />
      )}

      <div className={`min-w-0 ${page.showSidebar ? 'max-w-3xl mx-auto xl:mx-0' : 'max-w-none'} ${twoColumn ? 'xl:mx-0' : ''}`}>
        <header className="anim-fade-in-up">
          <h1 className="text-3xl font-bold inline-flex items-center gap-3">
            <FileText className="w-7 h-7 text-primary" />
            {page.title}
          </h1>
          {page.summary && <p className="mt-2 text-fg-muted text-sm">{page.summary}</p>}
          <hr className="mt-6 border-line" />
        </header>

        <MarkdownRenderer
          html={html}
          className="mt-8"
          // 与文章正文一致，保留统一管线（Expressive Code 高亮等）
        />

        {/* 插件扩展点：injectSinglePageContent 文末追加块 */}
        {contentBlocksNode}
      </div>

      {/* 自定义侧边栏内容 */}
      {twoColumn && (
        <aside className="hidden xl:block">
          <div className="sticky top-20 rounded-xl border border-line bg-bg p-4">
            <MarkdownRenderer html={sidebarHtml ?? ''} />
          </div>
        </aside>
      )}
    </div>
  );
}
