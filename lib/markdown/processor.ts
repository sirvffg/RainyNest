// lib/markdown/processor.ts — 服务端 Markdown → HTML 渲染管线（Server-only）
// 用 unified 全管线而非 react-markdown：Expressive Code 插件是异步的，
//    react-markdown 不支持异步 rehype 插件（会崩 "Unexpected value undefined for tree"）
// 管线按站点开关（enableCallouts/enableWikiLink/enableEmailProtection）缓存多份实例
import 'server-only';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkWikiLink from 'remark-wiki-link';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import rehypeCallouts from 'rehype-callouts';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Options as AutolinkOptions } from 'rehype-autolink-headings';
import type { Options as ExternalLinksOptions } from 'rehype-external-links';
import rehypeExpressiveCode from 'rehype-expressive-code';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { fireExtensionPoint } from '../plugin/engine';
import { getSiteSetting } from '../site';

// ═══════════════ 邮箱保护（自定义 rehype 插件）═══════════════
// 把文本节点中的邮箱混淆为 user[at]example[dot]com，防爬虫收割
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function rehypeEmailProtection() {
  return (tree: unknown) => {
    visit(tree as import('unist').Node, 'text', (node: { type: string; value: string }) => {
      if (typeof node.value === 'string' && node.value.includes('@')) {
        node.value = node.value.replace(EMAIL_RE, (email) => {
          const at = email.indexOf('@');
          const user = email.slice(0, at);
          const domain = email.slice(at + 1);
          return `${user}[at]${domain.replace(/\./g, '[dot]')}`;
        });
      }
    });
  };
}

// ═══════════════ 管线构建（按开关组合缓存）═══════════════
const processorCache = new Map<string, ReturnType<typeof buildProcessor>>();

interface PipelineFlags {
  callouts: boolean;
  wikiLink: boolean;
  emailProtection: boolean;
}

function buildProcessor(flags: PipelineFlags) {
  const p = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath);

  // [[双链]] → /pages/xxx（remark-wiki-link 经 data.hName 自动转 <a>）
  if (flags.wikiLink) {
    p.use(remarkWikiLink, {
      pageResolver: (name: string) => [name],
      hrefTemplate: (permalink: string) => `/pages/${encodeURIComponent(permalink)}`,
      wikiLinkClassName: 'wiki-link',
    });
  }

  p.use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeSlug)
    .use(...([rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: {
        className: ['anchor', 'ml-2', 'text-[var(--color-primary)]', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity'],
        ariaHidden: 'true',
      },
    }] as [typeof rehypeAutolinkHeadings, AutolinkOptions]));

  // ⭐ Expressive Code：代码高亮（行号 + 折叠 + 复制按钮），异步插件在此安全运行
  p.use(rehypeExpressiveCode, {
    themes: ['github-light', 'github-dark'],
    useDarkModeMediaQuery: true,
    plugins: [pluginLineNumbers(), pluginCollapsibleSections()],
    styleOverrides: {
      borderRadius: '0.75rem',
      codeFontSize: '0.875rem',
      codeFontFamily: 'var(--font-mono, ui-monospace, Menlo, Monaco, monospace)',
      codeLineHeight: '1.5rem',
    },
    frames: { showCopyToClipboardButton: true },
  });

  // Callout 提示块（> [!NOTE] 等语法）
  if (flags.callouts) {
    p.use(rehypeCallouts);
  }

  p.use(...([rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }] as [typeof rehypeExternalLinks, ExternalLinksOptions]));

  // 邮箱保护（放在外链处理之后，避免影响正常链接）
  if (flags.emailProtection) {
    p.use(rehypeEmailProtection);
  }

  return p.use(rehypeStringify);
}

function getProcessor(flags: PipelineFlags) {
  const key = `${flags.callouts ? 'c' : '-'}${flags.wikiLink ? 'w' : '-'}${flags.emailProtection ? 'e' : '-'}`;
  if (!processorCache.has(key)) {
    processorCache.set(key, buildProcessor(flags));
  }
  return processorCache.get(key)!;
}

export async function renderMarkdown(content: string): Promise<string> {
  // ① 插件先预处理 Markdown（onRenderMarkdown 扩展点）
  let processed = content;
  try {
    const results = await fireExtensionPoint('onRenderMarkdown', content);
    for (const r of results) {
      if (typeof r === 'string') processed = r;
    }
  } catch { /* 插件系统未就绪时直接渲染 */ }

  // ② 站点开关 → 选择管线（读取失败时用默认组合）
  let flags: PipelineFlags = { callouts: true, wikiLink: false, emailProtection: true };
  try {
    const site = await getSiteSetting();
    flags = {
      callouts: site.enableCallouts,
      wikiLink: site.enableWikiLink,
      emailProtection: site.enableEmailProtection,
    };
  } catch { /* 数据库未就绪 */ }

  // ③ unified 管线渲染为 HTML
  const result = await getProcessor(flags).process(processed);
  return String(result);
}
