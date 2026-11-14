// app/blog/page.tsx — 文章列表（分页，SSG + ISR）
import Link from 'next/link';
import { db } from '@/lib/prisma';
import PostCard, { type PostCardData } from '@/components/post/PostCard';

export const revalidate = 3600;

const PAGE_SIZE = 12;

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const current = Math.max(1, parseInt(page || '1', 10) || 1);

  let posts: PostCardData[] = [];
  let total = 0;
  try {
    const [list, count] = await Promise.all([
      db.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ isTop: 'desc' }, { publishedAt: 'desc' }],
        skip: (current - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { category: { select: { name: true, slug: true } } },
      }),
      db.post.count({ where: { status: 'PUBLISHED' } }),
    ]);
    posts = list;
    total = count;
  } catch { /* 数据库未就绪 */ }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold">博客</h1>
        <p className="mt-2 text-fg-muted text-sm">共 {total} 篇文章</p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          暂无文章
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-4 anim-fade-in">
          {current > 1 && (
            <Link
              href={`/blog?page=${current - 1}`}
              className="px-4 py-2 rounded border border-line text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
            >
              上一页
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-fg-muted">
            {current} / {totalPages}
          </span>
          {current < totalPages && (
            <Link
              href={`/blog?page=${current + 1}`}
              className="px-4 py-2 rounded border border-line text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
            >
              下一页
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
