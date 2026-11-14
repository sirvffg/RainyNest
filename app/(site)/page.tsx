// app/page.tsx — 首页（SSG + ISR）
import Link from 'next/link';
import { BookOpen, ArrowRight, PenLine } from 'lucide-react';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import PostCard, { type PostCardData } from '@/components/post/PostCard';

export const revalidate = 3600;

export default async function HomePage() {
  const site = await getSiteSetting();

  let posts: PostCardData[] = [];
  let total = 0;
  try {
    const [list, count] = await Promise.all([
      db.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ isTop: 'desc' }, { publishedAt: 'desc' }],
        take: 8,
        include: { category: { select: { name: true, slug: true } } },
      }),
      db.post.count({ where: { status: 'PUBLISHED' } }),
    ]);
    posts = list;
    total = count;
  } catch { /* 数据库未就绪 */ }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-10 text-center anim-fade-in-up">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {site.title}
        </h1>
        {site.subtitle && (
          <p className="mt-4 text-fg-muted text-lg">{site.subtitle}</p>
        )}
        <p className="mt-2 text-fg-muted">{site.description}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-white text-sm font-medium transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-95"
          >
            <BookOpen className="w-4 h-4" />
            浏览文章
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* 最新文章 */}
      <section>
        <div className="flex items-center justify-between mb-6 anim-fade-in">
          <h2 className="text-xl font-bold inline-flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            最新文章
          </h2>
          {total > 8 && (
            <Link href="/blog" className="text-sm text-primary transition-opacity hover:opacity-70">
              全部 {total} 篇 →
            </Link>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-12 text-center anim-fade-in">
            <p className="text-fg-muted">还没有文章 去后台写下第一篇吧</p>
            <Link
              href="/console/posts/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-white text-sm transition-all duration-200 hover:bg-primary-hover active:scale-95"
            >
              <PenLine className="w-4 h-4" />
              写文章
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
