// app/gallery/page.tsx — 相册列表
import { Camera } from 'lucide-react';
import { db } from '@/lib/prisma';
import GalleryCard, { type GalleryCardData } from '@/components/gallery/GalleryCard';

export const revalidate = 300;

export default async function GalleryListPage() {
  let galleries: GalleryCardData[] = [];
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
            <GalleryCard key={g.id} gallery={g} />
          ))}
        </div>
      )}
    </div>
  );
}
