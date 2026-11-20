// lib/markdown/comment.ts — 评论内容 Markdown 渲染（Server-only，严格白名单）
// 与文章管线分离：评论不启用 raw HTML / 代码高亮 / 自定义 class，
// 避免用户输入注入脚本或样式；最终再经过一层白名单清洗（防御性兜底）。
import 'server-only';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import type { Root as HastRoot, Element as HastElement, ElementContent, Properties } from 'hast';

// 允许的基础排版标签（评论场景足够用）
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
  'blockquote', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
]);

// 危险/无意义标签整体丢弃（连同子节点）
const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input',
  'button', 'select', 'textarea', 'link', 'meta', 'base', 'img', 'video', 'audio', 'canvas',
]);

const SAFE_HREF_RE = /^(https?:|mailto:|tel:)/i;

function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (!href) return null;
  if (href.startsWith('/') || href.startsWith('#')) return href;
  return SAFE_HREF_RE.test(href) ? href : null;
}

// 只保留明确允许的属性，其余（style/on* 等）全部移除
function pickProperties(el: HastElement): Properties {
  const src = (el.properties || {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (el.tagName === 'a') {
    const href = safeHref(src.href);
    if (href) {
      out.href = href;
      out.target = '_blank';
      out.rel = ['noopener', 'noreferrer', 'nofollow'];
    }
    if (typeof src.title === 'string') out.title = src.title.slice(0, 200);
  }

  if (el.tagName === 'code') {
    const classes = Array.isArray(src.className)
      ? src.className.map(String)
      : typeof src.className === 'string'
        ? src.className.split(/\s+/)
        : [];
    const lang = classes.find((c) => /^language-[A-Za-z0-9_+#.-]+$/.test(c));
    if (lang) out.className = [lang];
  }

  if (el.tagName === 'ol' && typeof src.start === 'number' && Number.isFinite(src.start)) {
    out.start = src.start;
  }

  if ((el.tagName === 'th' || el.tagName === 'td') && (src.align === 'left' || src.align === 'center' || src.align === 'right')) {
    out.align = src.align;
  }

  return out as Properties;
}

function cleanChildren(parent: HastRoot | HastElement): void {
  const next: ElementContent[] = [];
  for (const child of parent.children as ElementContent[]) {
    if (child.type === 'comment') continue;
    if (child.type === 'text') {
      next.push(child);
      continue;
    }
    if (child.type !== 'element') continue;

    const el = child as HastElement;
    if (DROP_TAGS.has(el.tagName)) continue;

    cleanChildren(el);
    el.properties = pickProperties(el);

    // 未在白名单内的标签：剥掉外壳，保留其文本/子结构
    if (!ALLOWED_TAGS.has(el.tagName)) {
      next.push(...el.children);
      continue;
    }
    next.push(el);
  }
  parent.children = next;
}

function rehypeCommentSanitize() {
  return (tree: unknown) => {
    cleanChildren(tree as HastRoot);
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let commentProcessor: ReturnType<typeof buildCommentProcessor> | null = null;

function buildCommentProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    // 不开启 allowDangerousHtml：评论中的原始 HTML 直接被丢弃
    .use(remarkRehype)
    .use(rehypeCommentSanitize)
    .use(rehypeStringify);
}

function getCommentProcessor() {
  if (!commentProcessor) commentProcessor = buildCommentProcessor();
  return commentProcessor;
}

/**
 * 渲染用户评论内容：基础 Markdown + 严格白名单，异常时降级为纯文本。
 */
export async function renderCommentMarkdown(content: string): Promise<string> {
  const source = typeof content === 'string' ? content : '';
  try {
    const result = await getCommentProcessor().process(source);
    return String(result);
  } catch {
    // 渲染失败不能让接口 500：原样转义输出
    return `<p class="markdown-fallback">${escapeHtml(source)}</p>`;
  }
}
