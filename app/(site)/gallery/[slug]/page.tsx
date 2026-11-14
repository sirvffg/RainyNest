// app/gallery/[slug]/page.tsx — 相册详情（CSS columns 瀑布流 + Lightbox）
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { db } from '@/lib/prisma';
import PhotoLightbox from '@/components/gallery/PhotoLightbox';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const gallery = await db.gallery.findUnique({ where: { slug } });
    if (!gallery) return { title: '相册不存在' };
    return {
      title: gallery.title,
      description: gallery.description || undefined,
      openGraph: { title: gallery.title, description: gallery.description || undefined, images: gallery.coverImage ? [gallery.coverImage] : undefined },
    };
  } catch {
    return { title: '相册' };
  }
}

export default async function GalleryDetailPage({ params }: Props) {
  const { slug } = await params;

  let gallery: {
    title: string; description: string | null; status: string;
    photos: { id: string; url: string; title: string | null; width: number | null; height: number | null }[];
  } | null = null;
  try {
    gallery = await db.gallery.findUnique({
      where: { slug },
      include: { photos: { orderBy: { createdAt: 'asc' } } },
    });
  } catch { /* 数据库未就绪 */ }

  if (!gallery || gallery.status !== 'PUBLISHED') notFound();

  return (
    <div>
      {/* 页头 */}
      <header className="anim-fade-in-up">
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1 text-sm text-fg-muted transition-all duration-200 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          返回相册
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{gallery.title}</h1>
        {gallery.description && (
          <p className="mt-2 text-fg-muted text-sm leading-relaxed">{gallery.description}</p>
        )}
        <p className="mt-2 inline-flex items-center gap-1 text-sm text-fg-muted">
          <ImageIcon className="w-4 h-4" />
          {gallery.photos.length} 张照片
        </p>
        <hr className="mt-6 border-line" />
      </header>

      {/* 瀑布流照片墙 */}
      {gallery.photos.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          相册里还没有照片
        </div>
      ) : (
        <div className="mt-8 anim-fade-in">
          <PhotoLightbox
            layout="masonry"
            photos={gallery.photos.map((p) => ({
              url: p.url,
              title: p.title,
              width: p.width,
              height: p.height,
            }))}
          />
        </div>
      )}
    </div>
  );
}
