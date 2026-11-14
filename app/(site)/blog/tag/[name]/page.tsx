// app/blog/tag/[name]/page.tsx — 按标签筛选文章列表
import Link from 'next/link';
import type { Metadata } from 'next';
import { Tag as TagIcon, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/prisma';
import PostCard, { type PostCardData } from '@/components/post/PostCard';

export const revalidate = 3600;

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  return { title: `标签「${name}」下的文章` };
}

export default async function TagPostsPage({ params }: Props) {
  const { name } = await params;

  let posts: PostCardData[] = [];
  let tagExists = false;
  try {
    const tag = await db.tag.findFirst({ where: { OR: [{ name }, { slug: name }] } });
    tagExists = !!tag;
    if (tag) {
      posts = await db.post.findMany({
        where: { status: 'PUBLISHED', tags: { some: { tagId: tag.id } } },
        orderBy: [{ isTop: 'desc' }, { publishedAt: 'desc' }],
        include: { category: { select: { name: true, slug: true } } },
      });
    }
  } catch { /* 数据库未就绪 */ }

  return (
    <div>
      <header className="anim-fade-in-up">
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-sm text-fg-muted transition-all duration-200 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          全部标签
        </Link>
        <h1 className="mt-3 text-3xl font-bold inline-flex items-center gap-3">
          <TagIcon className="w-7 h-7 text-primary" />
          {name}
        </h1>
        <p className="mt-2 text-fg-muted text-sm">
          {tagExists ? `共 ${posts.length} 篇文章` : '标签不存在'}
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          该标签下暂无文章
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
