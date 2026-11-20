// components/gallery/PhotoGrid.tsx — 照片墙（网格 / 瀑布流，点击进入 Lightbox）
import PhotoLightbox, { type PhotoItem } from './PhotoLightbox';

export default function PhotoGrid({
  photos,
  layout = 'grid',
  className = '',
}: {
  photos: PhotoItem[];
  layout?: 'grid' | 'masonry';
  className?: string;
}) {
  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
        相册里还没有照片
      </div>
    );
  }

  return <PhotoLightbox photos={photos} layout={layout} className={className} />;
}
