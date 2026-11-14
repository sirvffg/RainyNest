// app/categories/page.tsx — 分类列表页
import Link from 'next/link';
import { FolderOpen, Folders } from 'lucide-react';
import { db } from '@/lib/prisma';

export const revalidate = 3600;

export default async function CategoriesPage() {
  let categories: { id: string; name: string; slug: string; description: string | null; _count: { posts: number } }[] = [];
  try {
    categories = await db.category.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { name: 'asc' },
    });
  } catch { /* 数据库未就绪 */ }

  return (
    <div>
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <Folders className="w-7 h-7 text-primary" />
          分类
        </h1>
        <p className="mt-2 text-fg-muted text-sm">共 {categories.length} 个分类</p>
      </header>

      {categories.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          还没有分类
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {categories.map((cat, i) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="group rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 anim-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 10) * 0.05}s` }}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-semibold transition-colors group-hover:text-primary">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  {cat.name}
                </span>
                <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs text-fg-muted">
                  {cat._count.posts} 篇
                </span>
              </div>
              {cat.description && (
                <p className="mt-2 text-sm text-fg-muted line-clamp-2">{cat.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
