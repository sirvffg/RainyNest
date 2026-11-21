// app/archive/page.tsx — 归档时间轴（按年份分组）
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { db } from '@/lib/prisma';
import { resolveSystemTemplate, type ArchiveTemplateProps } from '@/lib/theme/templates';

export const revalidate = 300;

interface ArchivePost {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date | null;
  createdAt: Date;
}

export default async function ArchivePage() {
  let posts: ArchivePost[] = [];
  try {
    posts = await db.post.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, slug: true, publishedAt: true, createdAt: true },
    });
  } catch { /* 数据库未就绪 */ }

  // JS 内按年份分组（新的在前）
  const groups = new Map<number, ArchivePost[]>();
  for (const post of posts) {
    const date = post.publishedAt || post.createdAt;
    const year = date.getFullYear();
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(post);
  }
  const years = [...groups.entries()].sort((a, b) => b[0] - a[0]);

  // 主题覆盖归档：templates/archive.tsx
  let Override: Awaited<ReturnType<typeof resolveSystemTemplate<ArchiveTemplateProps>>> = null;
  try {
    Override = await resolveSystemTemplate<ArchiveTemplateProps>('archive');
  } catch (err) {
    console.error('[Theme] archive 模板加载失败，回退内置模板:', err);
  }

  if (Override) {
    const Template = Override.default;
    return (
      <Template
        total={posts.length}
        years={years.map(([year, items]) => ({
          year,
          posts: items.map((post) => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            date: post.publishedAt || post.createdAt,
          })),
        }))}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <Archive className="w-7 h-7 text-primary" />
          归档
        </h1>
        <p className="mt-2 text-fg-muted text-sm">共 {posts.length} 篇文章</p>
      </header>

      {years.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          暂无文章
        </div>
      ) : (
        <div className="relative mt-8 ml-2 border-l-2 border-line">
          {years.map(([year, items], gi) => (
            <div
              key={year}
              className="relative pl-5 md:pl-8 pb-10 last:pb-0 anim-fade-in-up"
              style={{ animationDelay: `${Math.min(gi, 6) * 0.06}s` }}
            >
              {/* 年份圆点 */}
              <span className="absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-primary bg-bg transition-transform duration-300 hover:scale-125" />

              <h2 className="text-2xl font-bold tracking-tight">{year}</h2>
              <p className="mt-0.5 text-xs text-fg-muted">{items.length} 篇</p>

              <ul className="mt-4 space-y-1">
                {items.map((post) => {
                  const date = post.publishedAt || post.createdAt;
                  return (
                    <li key={post.id}>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="group flex items-baseline gap-3 rounded px-2 py-1.5 -ml-2 transition-all duration-200 hover:bg-bg-secondary active:scale-[0.99]"
                      >
                        <time
                          dateTime={date.toISOString()}
                          className="shrink-0 text-xs text-fg-muted tabular-nums"
                        >
                          {date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                        </time>
                        <span className="min-w-0 truncate text-sm font-medium group-hover:text-primary transition-colors duration-200">
                          {post.title}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
