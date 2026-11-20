// lib/markdown/reading-time.ts — 阅读时间估算（Server-only，纯函数）
// 中文按 400 字/分钟、英文按 200 词/分钟，返回向上取整的分钟数（至少 1 分钟）。
// 注意：这里只提供估算能力，不自动向文章 HTML 插入内容，避免破坏文章模板。
import 'server-only';

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

export function estimateReadingTime(content: string): number {
  try {
    if (!content) return 1;

    // 去掉代码块、行内代码、图片与 HTML 标签，避免把代码/URL 当正文统计
    const text = content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/~~~[\s\S]*?~~~/g, ' ')
      .replace(/`[^`\n]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, ' ');

    const cjkCount = (text.match(CJK_RE) || []).length;
    // 先剔除中日韩字符，再按英文词计数
    const latinText = text.replace(CJK_RE, ' ');
    const wordCount = (latinText.match(WORD_RE) || []).length;

    return Math.max(1, Math.ceil(cjkCount / 400 + wordCount / 200));
  } catch {
    return 1;
  }
}
