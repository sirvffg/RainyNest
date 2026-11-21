// app/gallery/[slug]/page.tsx — 相册详情（CSS columns 瀑布流 + Lightbox）
// 页面模板可被主题覆盖（scripts/themes/<slug>/templates/photo.tsx）
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { db } from '@/lib/prisma';
import PhotoGrid from '@/components/gallery/PhotoGrid';
import { resolveSystemTemplate, type PhotoTemplateProps } from '@/lib/theme/templates';

export const revalidate = 600;

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

  const photos = gallery.photos.map((p) => ({
    url: p.url,
    title: p.title,
    width: p.width,
    height: p.height,
  }));

  const gridNode =
    photos.length === 0 ? null : (
      <div className="mt-8 anim-fade-in">
        <PhotoGrid layout="masonry" photos={photos} />
      </div>
    );

  let Override: Awaited<ReturnType<typeof resolveSystemTemplate<PhotoTemplateProps>>> = null;
  try {
    Override = await resolveSystemTemplate<PhotoTemplateProps>('photo');
  } catch (err) {
    console.error('[Theme] photo 模板加载失败，回退内置模板:', err);
  }

  if (Override) {
    const Template = Override.default;
    return (
      <Template
        gallery={{ title: gallery.title, description: gallery.description }}
        photos={photos}
        slots={{ grid: gridNode }}
      />
    );
  }

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
      {gridNode ?? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          相册里还没有照片
        </div>
      )}
    </div>
  );
}
