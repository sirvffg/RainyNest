// app/tags/page.tsx — 标签云（字号按文章数递增）
import Link from 'next/link';
import { Tag as TagIcon, Tags } from 'lucide-react';
import { db } from '@/lib/prisma';

export const revalidate = 300;

// 文章数映射字号：1 篇 0.875rem → 最多 1.75rem
function fontSize(count: number, max: number): string {
  const ratio = max > 1 ? (count - 1) / (max - 1) : 1;
  const rem = 0.875 + ratio * 0.875;
  return `${rem.toFixed(3)}rem`;
}

export default async function TagsPage() {
  let tags: { id: string; name: string; slug: string; _count: { posts: number } }[] = [];
  try {
    tags = await db.tag.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { name: 'asc' },
    });
  } catch { /* 数据库未就绪 */ }

  const max = Math.max(1, ...tags.map((t) => t._count.posts));

  return (
    <div>
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <Tags className="w-7 h-7 text-primary" />
          标签
        </h1>
        <p className="mt-2 text-fg-muted text-sm">共 {tags.length} 个标签</p>
      </header>

      {tags.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          还没有标签
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {tags.map((tag, i) => (
            <Link
              key={tag.id}
              href={`/blog/tag/${encodeURIComponent(tag.name)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-3.5 py-1.5 transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-sm active:scale-95 anim-fade-in-up"
              style={{ fontSize: fontSize(tag._count.posts, max), animationDelay: `${Math.min(i, 12) * 0.04}s` }}
            >
              <TagIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{tag.name}</span>
              <span className="text-fg-muted text-xs">{tag._count.posts}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
