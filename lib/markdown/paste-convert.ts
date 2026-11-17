// lib/markdown/paste-convert.ts — 把粘贴进来的纯 Markdown 转成 HTML
// 客户端能用的轻量转换（只用于编辑器 paste，不走服务端的 full pipeline）
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';

// 粗略检测一段纯文本是否像 Markdown
// 避免把普通换行文本（如邮件正文、代码片段）误判为 Markdown
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 4) return false;
  const markers = [
    /^#{1,6}\s+/m,           // 标题
    /```[\s\S]*?```/,        // 围栏代码块
    /^\|.*\|.*$/m,           // 表格行
    /^> /m,                  // 引用
    /^\s*[-*+]\s/m,          // 无序列表
    /\[[^\]]+\]\([^)]+\)/,   // 链接
    /!\[[^\]]*\]\([^)]+\)/,  // 图片
    /\*\*[^*]+\*\*/,         // 粗体
    /`[^`\n]+`/,             // 行内代码
    /^\d+\.\s/m,             // 有序列表
    /^---+$/m,               // 分割线
    /~~[^~]+~~/,             // 删除线
    /^\s*>\s*>\s/m,          // 嵌套引用
  ];
  const hitCount = markers.filter((r) => r.test(text)).length;
  return hitCount >= 2; // 至少命中两个 Markdown 特征才认定
}

// 纯 Markdown → HTML，客户端可跑
export async function markdownToHtml(md: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}
