// app/categories/[slug]/page.tsx — 按分类筛选文章列表
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FolderOpen, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/prisma';
import PostCard, { type PostCardData } from '@/components/post/PostCard';
import { resolveSystemTemplate, type CategoryTemplateProps } from '@/lib/theme/templates';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const category = await db.category.findUnique({ where: { slug } });
    if (!category) return { title: '分类不存在' };
    return {
      title: `分类「${category.name}」下的文章`,
      description: category.description || undefined,
    };
  } catch {
    return { title: '分类' };
  }
}

export default async function CategoryPostsPage({ params }: Props) {
  const { slug } = await params;

  let category: { id: string; name: string; description: string | null } | null = null;
  let posts: PostCardData[] = [];
  try {
    category = await db.category.findUnique({
      where: { slug },
      select: { id: true, name: true, description: true },
    });
    if (category) {
      posts = await db.post.findMany({
        where: { status: 'PUBLISHED', categoryId: category.id },
        orderBy: [{ isTop: 'desc' }, { publishedAt: 'desc' }],
        include: { category: { select: { name: true, slug: true } } },
      });
    }
  } catch { /* 数据库未就绪 */ }

  if (!category) notFound();

  const listNode =
    posts.length === 0 ? (
      <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
        该分类下暂无文章
      </div>
    ) : (
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} index={i} />
        ))}
      </div>
    );

  // 主题覆盖分类详情：templates/category.tsx
  let Override: Awaited<ReturnType<typeof resolveSystemTemplate<CategoryTemplateProps>>> = null;
  try {
    Override = await resolveSystemTemplate<CategoryTemplateProps>('category');
  } catch (err) {
    console.error('[Theme] category 模板加载失败，回退内置模板:', err);
  }

  if (Override) {
    const Template = Override.default;
    return (
      <Template
        category={{ name: category.name, slug, description: category.description }}
        posts={posts}
        slots={{ list: listNode }}
      />
    );
  }

  return (
    <div>
      <header className="anim-fade-in-up">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-fg-muted transition-all duration-200 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          全部文章
        </Link>
        <h1 className="mt-3 text-3xl font-bold inline-flex items-center gap-3">
          <FolderOpen className="w-7 h-7 text-primary" />
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-2 text-fg-muted text-sm leading-relaxed">{category.description}</p>
        )}
        <p className="mt-2 text-fg-muted text-sm">共 {posts.length} 篇文章</p>
      </header>

      {listNode}
    </div>
  );
}
