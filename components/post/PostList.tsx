// components/post/PostList.tsx — 文章卡片列表（统一网格 + 空状态）
import type { ReactNode } from 'react';
import PostCard, { type PostCardData } from './PostCard';

export default function PostList({
  posts,
  empty,
  className = 'grid grid-cols-1 md:grid-cols-2 gap-4',
}: {
  posts: PostCardData[];
  empty?: ReactNode;
  className?: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
        {empty ?? '暂无文章'}
      </div>
    );
  }

  return (
    <div className={className}>
      {posts.map((post, i) => (
        <PostCard key={post.id} post={post} index={i} />
      ))}
    </div>
  );
}
