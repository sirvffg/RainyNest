// app/blog/[slug]/page.tsx — 文章详情（TOC + 评论 + JSON-LD + Metadata）
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';
import { Eye, Clock, FolderOpen, Tag as TagIcon, MessageSquare, MessageSquareOff } from 'lucide-react';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import { firstWins } from '@/lib/plugin/engine';
import { collectPostContentHtml, getCommentWidgetHtml } from '@/lib/plugin/ui';
import { renderMarkdown } from '@/lib/markdown/processor';
import TableOfContents from '@/components/post/TableOfContents';
import CommentList, { type CommentNode } from '@/components/comment/CommentList';
import CommentForm from '@/components/comment/CommentForm';
import JsonLd from '@/components/seo/JsonLd';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await db.post.findUnique({
      where: { slug },
      include: { author: { select: { displayName: true } } },
    });
    if (!post) return { title: '文章不存在' };
    const date = post.publishedAt || post.createdAt;

    // 基础 metadata 作为插件 onGenerateMetadata 扩展点的输入
    const metadata: Record<string, unknown> = {
      title: post.title,
      description: post.summary || undefined,
      openGraph: {
        title: post.title,
        description: post.summary || undefined,
        type: 'article',
        publishedTime: date.toISOString(),
        authors: [post.author.displayName],
        images: post.coverImage ? [post.coverImage] : undefined,
      },
    };
    try {
      const patch = await firstWins('onGenerateMetadata', {
        metadata,
        post: {
          id: post.id,
          slug: post.slug,
          title: post.title,
          summary: post.summary,
          coverImage: post.coverImage,
          publishedAt: date.toISOString(),
        },
      });
      if (patch && typeof patch === 'object') Object.assign(metadata, patch);
    } catch { /* 插件系统未就绪 */ }

    return metadata as Metadata;
  } catch {
    return { title: '文章' };
  }
}

// 已通过评论 → 树形结构（后端仅存 parentId 平铺数据）
async function getCommentTree(postId: string): Promise<CommentNode[]> {
  const flat = await db.comment.findMany({
    where: { postId, status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { displayName: true, username: true, avatar: true } } },
  });

  const map = new Map<string, CommentNode>();
  for (const c of flat) {
    map.set(c.id, { id: c.id, content: c.content, createdAt: c.createdAt, user: c.user, replies: [] });
  }
  const roots: CommentNode[] = [];
  for (const c of flat) {
    const node = map.get(c.id)!;
    const parent = c.parentId ? map.get(c.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  const postInclude = {
    author: { select: { displayName: true } },
    category: { select: { name: true, slug: true } },
    tags: { include: { tag: { select: { name: true, slug: true } } } },
  } satisfies Prisma.PostInclude;

  let post: Prisma.PostGetPayload<{ include: typeof postInclude }> | null = null;
  try {
    post = await db.post.findUnique({
      where: { slug },
      include: postInclude,
    });
  } catch { /* 数据库未就绪 */ }

  if (!post || post.status !== 'PUBLISHED') notFound();

  const site = await getSiteSetting();
  // 服务端 unified 管线渲染（插件预处理 + Expressive Code 异步高亮）
  const html = await renderMarkdown(post.content);
  const date = post.publishedAt || post.createdAt;

  let comments: CommentNode[] = [];
  try {
    comments = await getCommentTree(post.id);
  } catch { /* 数据库未就绪 */ }

  // 插件扩展点：文末追加块 + 第三方评论替换
  let postContentBlocks: string[] = [];
  let commentWidgetHtml: string | null = null;
  try {
    [postContentBlocks, commentWidgetHtml] = await Promise.all([
      collectPostContentHtml(),
      getCommentWidgetHtml(),
    ]);
  } catch { /* 插件系统未就绪 */ }

  // JSON-LD（BlogPosting）
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary,
    datePublished: date.toISOString(),
    author: { '@type': 'Person', name: post.author.displayName },
    publisher: { '@type': 'Organization', name: site.title },
    image: post.coverImage || undefined,
  };

  return (
    <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-10">
      <JsonLd data={jsonLd} />

      {/* 主栏 */}
      <div className="min-w-0 max-w-3xl mx-auto lg:mx-0">
        {/* 移动端目录（lg 以下显示在文首） */}
        <div className="mb-6">
          <TableOfContents html={html} variant="mobile" />
        </div>

        <article>
          {/* 文章头 */}
          <header className="anim-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
              <span>{post.author.displayName}</span>
              <time dateTime={date.toISOString()} className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {post.views} 次浏览
              </span>
              {post.category && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {post.category.name}
                </span>
              )}
            </div>
            {post.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {post.tags.map(({ tag }) => (
                  <span key={tag.slug} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-secondary text-xs text-fg-muted transition-colors hover:text-primary">
                    <TagIcon className="w-3 h-3" />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            <hr className="mt-6 border-line" />
          </header>

          {/* 正文 */}
          <div
            className="mt-8 markdown-body anim-fade-in"
            style={{ animationDelay: '0.15s' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* 插件扩展点：injectPostContent 文末追加块（相关文章/打赏/版权等） */}
          {postContentBlocks.length > 0 && (
            <div className="mt-8 space-y-4">
              {postContentBlocks.map((block, i) => (
                <div
                  key={i}
                  className="anim-fade-in"
                  style={{ animationDelay: `${0.2 + i * 0.05}s` }}
                  dangerouslySetInnerHTML={{ __html: block }}
                />
              ))}
            </div>
          )}
        </article>

        {/* 评论区（插件 injectCommentWidget 可整体替换为第三方评论） */}
        <section className="mt-14">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold anim-fade-in-up">
            <MessageSquare className="w-5 h-5 text-primary" />
            评论
            <span className="text-sm font-normal text-fg-muted">{comments.length} 条</span>
          </h2>

          {commentWidgetHtml ? (
            <div
              className="mt-5 anim-fade-in"
              dangerouslySetInnerHTML={{ __html: commentWidgetHtml }}
            />
          ) : (
            <div className="mt-5 space-y-6">
              {post.allowComment ? (
                <CommentForm postId={post.id} />
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-fg-muted anim-fade-in">
                  <MessageSquareOff className="w-4 h-4" />
                  作者已关闭本文评论
                </p>
              )}

              <CommentList comments={comments} />
            </div>
          )}
        </section>
      </div>

      {/* 侧栏：桌面端固定目录 */}
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <TableOfContents html={html} variant="desktop" />
        </div>
      </aside>
    </div>
  );
}
