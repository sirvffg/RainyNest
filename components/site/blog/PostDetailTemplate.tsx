// components/site/blog/PostDetailTemplate.tsx — 文章详情页内置模板
// 主题可通过 scripts/themes/<slug>/templates/post-detail.tsx 覆盖本组件，
// Props 契约见 lib/theme/templates.ts（PostDetailTemplateProps）
import { Eye, Clock, FolderOpen, Tag as TagIcon, MessageSquare } from 'lucide-react';
import type { PostDetailTemplateProps } from '@/lib/theme/templates';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';

export default function PostDetailTemplate({ post, html, commentsCount, slots }: PostDetailTemplateProps) {
  const date = post.date;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-10">
      {/* 主栏 */}
      <div className="min-w-0 max-w-3xl mx-auto lg:mx-0">
        {/* 移动端目录（lg 以下显示在文首） */}
        <div className="mb-6">{slots.tocMobile}</div>

        <article>
          {/* 文章头 */}
          <header className="anim-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
              <span>{post.author}</span>
              <time dateTime={date.toISOString()} className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {post.views} 次浏览
              </span>
              {post.category && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {post.category.name}
                </span>
              )}
            </div>
            {post.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {post.tags.map((tag) => (
                  <span key={tag.slug} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-secondary text-xs text-fg-muted transition-colors hover:text-primary">
                    <TagIcon className="w-3 h-3" />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            <hr className="mt-6 border-line" />
          </header>

          {/* 正文 */}
          <MarkdownRenderer
            html={html}
            className="mt-8"
            // 动画延迟由容器类统一控制
          />

          {/* 插件扩展点：injectPostContent 文末追加块（相关文章/打赏/版权等） */}
          {slots.contentBlocks}
        </article>

        {/* 评论区（宿主已处理第三方评论替换 / 关闭评论） */}
        <section className="mt-14">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold anim-fade-in-up">
            <MessageSquare className="w-5 h-5 text-primary" />
            评论
            <span className="text-sm font-normal text-fg-muted">{commentsCount} 条</span>
          </h2>
          <div className="mt-5">{slots.comments}</div>
        </section>
      </div>

      {/* 侧栏：桌面端固定目录 */}
      <aside className="hidden lg:block">
        <div className="sticky top-20">{slots.tocDesktop}</div>
      </aside>
    </div>
  );
}
