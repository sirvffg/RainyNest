// components/post/PostMeta.tsx — 文章元信息（日期 / 分类 / 浏览数）
import { Eye, Clock, FolderOpen } from 'lucide-react';

export default function PostMeta({
  date,
  views,
  category,
  className = '',
}: {
  date?: Date;
  views?: number;
  category?: { name: string; slug: string } | null;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-fg-muted ${className}`}>
      {category && (
        <span className="inline-flex items-center gap-1 text-primary">
          <FolderOpen className="w-3.5 h-3.5" />
          {category.name}
        </span>
      )}
      {date && (
        <time dateTime={date.toISOString()} className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
      )}
      {typeof views === 'number' && (
        <span className="inline-flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          {views} 次浏览
        </span>
      )}
    </div>
  );
}
