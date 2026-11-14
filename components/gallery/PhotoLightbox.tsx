// components/gallery/PhotoLightbox.tsx — 图片墙 + 全屏 Lightbox（客户端交互）
'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface PhotoItem {
  url: string;
  title?: string | null;
  width?: number | null;
  height?: number | null;
}

export default function PhotoLightbox({
  photos,
  layout = 'grid',
  className = '',
}: {
  photos: PhotoItem[];
  /** grid：等比网格（说说）；masonry：CSS columns 瀑布流（相册详情） */
  layout?: 'grid' | 'masonry';
  className?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length]
  );

  // ESC 关闭 / 方向键切换 / 锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close, prev, next]);

  if (photos.length === 0) return null;
  const multi = photos.length > 1;
  const current = index !== null ? photos[index] : null;

  const cell = (p: PhotoItem, i: number) => {
    const ratio = p.width && p.height ? `${p.width} / ${p.height}` : undefined;
    if (layout === 'masonry') {
      return (
        <button
          key={p.url + i}
          type="button"
          onClick={() => setIndex(i)}
          aria-label={`查看图片 ${i + 1}`}
          className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg border border-line bg-bg-secondary anim-fade-in-up transition-all duration-300 hover:shadow-md hover:border-primary/40 active:scale-[0.99]"
          style={{ animationDelay: `${Math.min(i, 10) * 0.05}s` }}
        >
          <img
            src={p.url}
            alt={p.title || `图片 ${i + 1}`}
            width={p.width || undefined}
            height={p.height || undefined}
            loading="lazy"
            style={{ aspectRatio: ratio }}
            className="w-full h-auto transition-transform duration-500 ease-smooth group-hover:scale-[1.03]"
          />
        </button>
      );
    }
    return (
      <button
        key={p.url + i}
        type="button"
        onClick={() => setIndex(i)}
        aria-label={`查看图片 ${i + 1}`}
        className="group relative block overflow-hidden rounded-lg border border-line bg-bg-secondary anim-fade-in-up transition-all duration-300 hover:shadow-md hover:border-primary/40 active:scale-[0.98]"
        style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
      >
        <img
          src={p.url}
          alt={`图片 ${i + 1}`}
          loading="lazy"
          style={{ aspectRatio: ratio }}
          className={
            multi
              ? 'aspect-square w-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-110'
              : 'max-h-96 w-auto max-w-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-[1.02]'
          }
        />
      </button>
    );
  };

  return (
    <>
      {/* 图片墙 */}
      {layout === 'masonry' ? (
        <div className={`columns-2 md:columns-3 gap-4 ${className}`}>{photos.map(cell)}</div>
      ) : (
        <div className={`grid gap-2.5 ${multi ? 'grid-cols-3' : 'grid-cols-1'} ${className}`}>
          {photos.map(cell)}
        </div>
      )}

      {/* 全屏 Lightbox */}
      {open && current && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm anim-fade-in"
        >
          {/* 关闭 */}
          <button
            type="button"
            onClick={close}
            aria-label="关闭"
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 左右切换 */}
          {multi && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="上一张"
                className="absolute left-2 md:left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-90"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="下一张"
                className="absolute right-2 md:right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-90"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* 当前图片 */}
          <img
            key={current.url}
            src={current.url}
            alt={current.title || ''}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[88vw] max-h-[82vh] rounded-lg object-contain shadow-2xl anim-scale-in select-none"
          />

          {/* 标题与计数 */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 text-sm text-white/80 anim-fade-in">
            {current.title && <span className="max-w-[60vw] truncate">{current.title}</span>}
            <span>{(index ?? 0) + 1} / {photos.length}</span>
          </div>
        </div>
      )}
    </>
  );
}
