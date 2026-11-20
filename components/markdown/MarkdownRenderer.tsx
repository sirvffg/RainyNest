// components/markdown/MarkdownRenderer.tsx — 服务端 Markdown 正文渲染
// 优先使用外部传入的 html（文章页需复用给目录），否则调用统一管线渲染
import { renderMarkdown } from '@/lib/markdown/processor';

export default async function MarkdownRenderer({
  content,
  html,
  className = '',
}: {
  content?: string;
  html?: string;
  className?: string;
}) {
  const output = html ?? (content ? await renderMarkdown(content) : '');

  return (
    <div
      className={`markdown-body anim-fade-in ${className}`}
      dangerouslySetInnerHTML={{ __html: output }}
    />
  );
}
