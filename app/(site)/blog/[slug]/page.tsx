// app/blog/[slug]/page.tsx — 文章详情（数据 + 插槽组装 + JSON-LD + Metadata）
// 页面模板可被主题覆盖（scripts/themes/<slug>/templates/post-detail.tsx）
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';
import { MessageSquareOff } from 'lucide-react';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import { firstWins } from '@/lib/plugin/engine';
import { collectPostContentHtml, getCommentWidgetHtml, collectCommentFields, getCommentEditorComponent, getCommentContentRenderer, renderPluginComponentHtml } from '@/lib/plugin/ui';
import type { CommentContentProps } from '@/lib/plugin/ui';
import { renderMarkdown } from '@/lib/markdown/processor';
import { resolveSystemTemplate, type PostDetailTemplateProps, type PostDetailTemplate as PostDetailTemplateComp } from '@/lib/theme/templates';
import PostDetailTemplate from '@/components/site/blog/PostDetailTemplate';
import TableOfContents from '@/components/post/TableOfContents';
import CommentList, { type CommentNode } from '@/components/comment/CommentList';
import CommentForm from '@/components/comment/CommentForm';
import JsonLd from '@/components/seo/JsonLd';

export const revalidate = 600;

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

// 插件评论内容渲染：逐条预渲染为 HTML 挂到节点上，单条失败只回退该条原内容
async function attachCommentContentHtml(
  nodes: CommentNode[],
  renderer: NonNullable<Awaited<ReturnType<typeof getCommentContentRenderer>>>
): Promise<void> {
  const flat: CommentNode[] = [];
  const walk = (list: CommentNode[]) => {
    for (const node of list) {
      flat.push(node);
      walk(node.replies);
    }
  };
  walk(nodes);

  await Promise.all(
    flat.map(async (node) => {
      try {
        const html = await renderPluginComponentHtml(renderer, {
          comment: node as unknown as CommentContentProps['comment'],
        });
        if (html) node.contentHtml = html;
      } catch (err) {
        console.error(`[Plugin] commentListItemContentReplace 渲染评论 ${node.id} 失败，回退原内容:`, err);
      }
    })
  );
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

  // 插件扩展点：文末追加块 + 第三方评论替换 + 评论表单字段 + 评论编辑器/内容渲染替换
  let postContentBlocks: string[] = [];
  let commentWidgetHtml: string | null = null;
  let commentFields: Awaited<ReturnType<typeof collectCommentFields>> = [];
  let commentEditor: Awaited<ReturnType<typeof getCommentEditorComponent>> = null;
  let commentContentRenderer: Awaited<ReturnType<typeof getCommentContentRenderer>> = null;
  try {
    [postContentBlocks, commentWidgetHtml, commentFields, commentEditor, commentContentRenderer] =
      await Promise.all([
        collectPostContentHtml(),
        getCommentWidgetHtml(),
        collectCommentFields(),
        getCommentEditorComponent(),
        getCommentContentRenderer(),
      ]);
  } catch { /* 插件系统未就绪 */ }

  // 插件评论编辑器：服务端预渲染为 HTML，渲染抛错时回退内置 CommentForm（不整页 500）
  let commentEditorHtml: string | null = null;
  if (commentEditor) {
    try {
      commentEditorHtml = await renderPluginComponentHtml(commentEditor, {
        postId: post.id,
        fields: commentFields,
      });
    } catch (err) {
      console.error('[Plugin] commentEditorReplace 渲染失败，回退内置评论表单:', err);
    }
  }

  // 插件评论内容渲染：为每条评论（含回复）预渲染 HTML
  if (commentContentRenderer && comments.length > 0) {
    await attachCommentContentHtml(comments, commentContentRenderer);
  }

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

  // 主题覆盖优先，回退内置模板；覆盖模板编译失败也回退
  let Template: PostDetailTemplateComp = PostDetailTemplate;
  try {
    const override = await resolveSystemTemplate<PostDetailTemplateProps>('post');
    if (override) Template = override.default;
  } catch (err) {
    console.error('[Theme] post-detail 主题模板加载失败，回退内置模板:', err);
  }

  // 插槽：交互区块由系统渲染，主题模板只决定摆放位置
  const props: PostDetailTemplateProps = {
    post: {
      slug: post.slug,
      title: post.title,
      author: post.author.displayName,
      date,
      views: post.views,
      category: post.category,
      tags: post.tags.map(({ tag }) => ({ name: tag.name, slug: tag.slug })),
      coverImage: post.coverImage,
      allowComment: post.allowComment,
    },
    html,
    commentsCount: comments.length,
    slots: {
      tocMobile: <TableOfContents html={html} variant="mobile" />,
      tocDesktop: <TableOfContents html={html} variant="desktop" />,
      comments: commentWidgetHtml ? (
        <div className="anim-fade-in" dangerouslySetInnerHTML={{ __html: commentWidgetHtml }} />
      ) : (
        <div className="space-y-6">
          {post.allowComment ? (
            commentEditorHtml !== null ? (
              <div className="anim-fade-in" dangerouslySetInnerHTML={{ __html: commentEditorHtml }} />
            ) : (
              <CommentForm postId={post.id} fields={commentFields} />
            )
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-fg-muted anim-fade-in">
              <MessageSquareOff className="w-4 h-4" />
              作者已关闭本文评论
            </p>
          )}
          <CommentList comments={comments} />
        </div>
      ),
      contentBlocks:
        postContentBlocks.length > 0 ? (
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
        ) : null,
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Template {...props} />
    </>
  );
}
