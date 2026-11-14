// components/moments/MomentCard.tsx — 单条说说卡片
import { User } from 'lucide-react';
import PhotoLightbox from '@/components/gallery/PhotoLightbox';

export interface MomentCardData {
  id: string;
  content: string;
  images: string | null;
  createdAt: Date;
  user: { displayName: string; avatar: string | null };
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch {
    return [];
  }
}

export default function MomentCard({ moment, index = 0 }: { moment: MomentCardData; index?: number }) {
  const images = parseImages(moment.images);

  return (
    <article
      className="anim-fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
    >
      <div className="rounded-lg border border-line bg-bg p-4 md:p-5 transition-all duration-300 hover:shadow-md hover:border-primary/40">
        {/* 作者信息 */}
        <div className="flex items-center gap-3">
          {moment.user.avatar ? (
            <img
              src={moment.user.avatar}
              alt={moment.user.displayName}
              loading="lazy"
              className="w-9 h-9 rounded-full object-cover transition-transform duration-200 hover:scale-110"
            />
          ) : (
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-bg-secondary text-fg-muted transition-colors duration-200 hover:text-primary">
              <User className="w-4 h-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{moment.user.displayName}</p>
            <time
              dateTime={moment.createdAt.toISOString()}
              className="text-xs text-fg-muted"
            >
              {moment.createdAt.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </div>
        </div>

        {/* 内容 */}
        <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {moment.content}
        </p>

        {/* 图片网格（可点击进入 lightbox） */}
        {images.length > 0 && (
          <PhotoLightbox
            photos={images.map((url) => ({ url }))}
            className="mt-3"
          />
        )}
      </div>
    </article>
  );
}
