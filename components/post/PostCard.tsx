import Link from 'next/link';
import { Eye, Clock, FolderOpen } from 'lucide-react';

export interface PostCardData {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImage: string | null;
  views: number;
  createdAt: Date;
  publishedAt: Date | null;
  category?: { name: string; slug: string } | null;
}

export default function PostCard({ post, index = 0 }: { post: PostCardData; index?: number }) {
  const date = post.publishedAt || post.createdAt;

  return (
    <article
      className="anim-fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
    >
      <Link
        href={`/blog/${post.slug}`}
        className="group block rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.99]"
      >
        {/* 封面图（lazy + hover 缩放） */}
        {post.coverImage && (
          <div className="-mx-5 -mt-5 mb-4 overflow-hidden rounded-t-lg">
            <img
              src={post.coverImage}
              alt={post.title}
              loading="lazy"
              className="aspect-video w-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
            />
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-fg-muted">
          {post.category && (
            <span className="inline-flex items-center gap-1 text-primary">
              <FolderOpen className="w-3.5 h-3.5" />
              {post.category.name}
            </span>
          )}
          <time dateTime={date.toISOString()}>
            {date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
        </div>

        <h2 className="mt-2.5 text-lg font-semibold group-hover:text-primary transition-colors duration-200">
          {post.title}
        </h2>

        {post.summary && (
          <p className="mt-2 text-sm text-fg-muted line-clamp-2 leading-relaxed">{post.summary}</p>
        )}

        <div className="mt-4 flex items-center gap-4 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {post.views} 次浏览
          </span>
        </div>
      </Link>
    </article>
  );
}
