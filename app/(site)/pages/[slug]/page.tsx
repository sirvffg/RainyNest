// app/pages/[slug]/page.tsx — 独立页面（Markdown 渲染）
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { db } from '@/lib/prisma';
import { renderMarkdown } from '@/lib/markdown/processor';

export const revalidate = 3600;

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

  let page: { title: string; summary: string | null; content: string; status: string } | null = null;
  try {
    page = await db.page.findUnique({
      where: { slug },
      select: { title: true, summary: true, content: true, status: true },
    });
  } catch { /* 数据库未就绪 */ }

  if (!page || page.status !== 'PUBLISHED') notFound();

  // 服务端 unified 管线渲染（与文章正文一致，含 Expressive Code 高亮）
  const html = await renderMarkdown(page.content);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <FileText className="w-7 h-7 text-primary" />
          {page.title}
        </h1>
        {page.summary && <p className="mt-2 text-fg-muted text-sm">{page.summary}</p>}
        <hr className="mt-6 border-line" />
      </header>

      <div
        className="mt-8 markdown-body anim-fade-in"
        style={{ animationDelay: '0.1s' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
