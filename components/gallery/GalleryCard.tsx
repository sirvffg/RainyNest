// components/gallery/GalleryCard.tsx — 相册封面卡片
import Link from 'next/link';
import { Image as ImageIcon } from 'lucide-react';

export interface GalleryCardData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  _count: { photos: number };
}

export default function GalleryCard({ gallery }: { gallery: GalleryCardData }) {
  return (
    <Link
      href={`/gallery/${gallery.slug}`}
      className="group block overflow-hidden rounded-lg border border-line bg-bg transition-all duration-300 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.99]"
    >
      {/* 封面 */}
      <div className="aspect-[16/10] overflow-hidden bg-bg-secondary">
        {gallery.coverImage ? (
          <img
            src={gallery.coverImage}
            alt={gallery.title}
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
          {gallery.title}
        </h2>
        {gallery.description && (
          <p className="mt-1.5 text-sm text-fg-muted line-clamp-2 leading-relaxed">
            {gallery.description}
          </p>
        )}
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-fg-muted">
          <ImageIcon className="w-3.5 h-3.5" />
          {gallery._count.photos} 张照片
        </p>
      </div>
    </Link>
  );
}
