// app/gallery/page.tsx — 相册列表
import Link from 'next/link';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { db } from '@/lib/prisma';

export const revalidate = 3600;

export default async function GalleryListPage() {
  let galleries: {
    id: string; title: string; slug: string; description: string | null;
    coverImage: string | null; _count: { photos: number };
  }[] = [];
  try {
    galleries = await db.gallery.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { photos: true } } },
    });
  } catch { /* 数据库未就绪 */ }

  return (
    <div>
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <Camera className="w-7 h-7 text-primary" />
          相册
        </h1>
        <p className="mt-2 text-fg-muted text-sm">共 {galleries.length} 个相册</p>
      </header>

      {galleries.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          还没有相册
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {galleries.map((g) => (
            <Link
              key={g.id}
              href={`/gallery/${g.slug}`}
              className="group block overflow-hidden rounded-lg border border-line bg-bg transition-all duration-300 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.99]"
            >
              {/* 封面 */}
              <div className="aspect-[16/10] overflow-hidden bg-bg-secondary">
                {g.coverImage ? (
                  <img
                    src={g.coverImage}
                    alt={g.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-fg-muted/50">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
              </div>

              {/* 信息 */}
              <div className="p-4">
                <h2 className="font-semibold group-hover:text-primary transition-colors duration-200">
                  {g.title}
                </h2>
                {g.description && (
                  <p className="mt-1.5 text-sm text-fg-muted line-clamp-2 leading-relaxed">
                    {g.description}
                  </p>
                )}
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-fg-muted">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {g._count.photos} 张照片
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
