// lib/markdown/processor.ts — 服务端 Markdown → HTML 渲染管线（Server-only）
// 用 unified 全管线而非 react-markdown：Expressive Code 插件是异步的，
//    react-markdown 不支持异步 rehype 插件（会崩 "Unexpected value undefined for tree"）
// 管线按站点开关（callouts / wikiLink / emailProtection / sectionize /
//   codeTabGroup / figure / mermaid / plantuml）缓存多份实例；
// 缓存 key 包含全部开关，避免切换设置后命中旧实例。
import 'server-only';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkWikiLink from 'remark-wiki-link';
import remarkDirective from 'remark-directive';
import remarkSectionize from 'remark-sectionize';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import rehypeCallouts from 'rehype-callouts';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { deflateRawSync } from 'node:zlib';
import type { Root as MdastRoot, Content, Parent as MdastParent } from 'mdast';
import type { Root as HastRoot, Element as HastElement, ElementContent, Properties } from 'hast';
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

// ═══════════════ 指令容器：:::` 标题 预处理 ═══════════════
// remark-directive 只识别官方 `:::tip[标题]` 标签语法，这里把常见的
// `:::tip 标题` 改写成标签语法；跳过围栏代码块与缩进代码，避免误改示例。
const DIRECTIVE_TITLE_RE = /^((?: {0,3}> ?)*)( {0,3})(:{3,})([A-Za-z][\w-]*)[ \t]+(?![[{])(.+?)\s*$/;

function normalizeDirectiveTitles(source: string): string {
  const lines = source.split(/\r?\n/);
  let fence: { char: string; len: number } | null = null;

  const out = lines.map((line) => {
    // 围栏代码块的开/闭（支持 > 引用前缀）
    const fenceMatch = /^((?: {0,3}> ?)*)\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[2];
      if (!fence) {
        fence = { char: marker[0], len: marker.length };
        return line;
      }
      if (marker[0] === fence.char && marker.length >= fence.len) {
        fence = null;
      }
      return line;
    }
    if (fence) return line;

    const body = line.replace(/^(?: {0,3}> ?)+/, '');
    if (/^( {4}|\t)/.test(body)) return line; // 缩进代码块
    if (!body.startsWith(':::')) return line;

    const m = DIRECTIVE_TITLE_RE.exec(line);
    if (!m) return line;
    const [, quotePrefix, indent, colons, name, title] = m;
    // 标题里出现 ] 会破坏标签语法，保持原样交给后续解析
    if (title.includes(']')) return line;
    return `${quotePrefix}${indent}${colons}${name}[${title.trim()}]`;
  });

  return out.join('\n');
}

// ═══════════════ admonition 容器（:::note / :::tip ...）═══════════════
// 与 rehype-callouts（> [!NOTE]）互不影响：
//   - callout 语法由 enableCallouts 控制
//   - ::: 指令容器始终可用（directive 语法本身没有对应开关）
const ADMONITION_TYPES = new Set(['note', 'tip', 'warning', 'danger', 'info', 'important', 'caution']);
const ADMONITION_TITLES: Record<string, string> = {
  note: '注意',
  tip: '提示',
  warning: '警告',
  danger: '危险',
  info: '信息',
  important: '重要',
  caution: '小心',
};

function mdastText(node: Content): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  const children = (node as MdastParent).children;
  if (Array.isArray(children)) return children.map((child) => mdastText(child as Content)).join('');
  return '';
}

function remarkAdmonitions(options: { codeTabGroup: boolean }) {
  return (tree: import('unist').Node) => {
    visit(tree, (node: any) => {
      if (!node || node.type !== 'containerDirective') return;
      const name = typeof node.name === 'string' ? node.name.toLowerCase() : '';

      // :::code-group 容器：仅打标记，真正的 Tab 化在 rehype 阶段（Expressive Code 之后）
      if (name === 'code-group') {
        if (!options.codeTabGroup) return;
        node.data = {
          hName: 'div',
          hProperties: { className: ['code-group'], dataTabs: 'true' },
        };
        return;
      }

      if (!ADMONITION_TYPES.has(name)) return;

      const children: Content[] = Array.isArray(node.children) ? [...node.children] : [];
      const labelIndex = children.findIndex(
        (child) => child.type === 'paragraph' && (child.data as { directiveLabel?: boolean } | undefined)?.directiveLabel,
      );
      let title = '';
      if (labelIndex >= 0) {
        title = mdastText(children[labelIndex]).trim();
        children.splice(labelIndex, 1);
      }
      if (!title) title = ADMONITION_TITLES[name] ?? name;

      const titleNode = {
        type: 'paragraph',
        data: { hName: 'p', hProperties: { className: ['admonition-title'] } },
        children: [{ type: 'text', value: title }],
      } as unknown as Content;

      node.children = [titleNode, ...children];
      node.data = {
        hName: 'div',
        hProperties: { className: ['admonition', `admonition-${name}`] },
      };
    });

    // 嵌套 ::: 容器时，remark-directive 可能残留一个孤立的 ":::" 段落，清掉它
    visit(tree, 'paragraph', (node: any, index: number | undefined, parent: any) => {
      if (!parent || typeof index !== 'number') return;
      const text = mdastText(node).trim();
      if (/^:{3,}$/.test(text)) {
        parent.children.splice(index, 1);
        return index;
      }
    });
  };
}

// ═══════════════ Mermaid / PlantUML 占位节点 ═══════════════
// 在交给 Expressive Code 之前把图表代码块替换为占位 div，
// 避免被当作普通代码高亮；rehype 阶段再还原成 <pre class="mermaid"> / <img>。
const DIAGRAM_LANGS = new Map<string, 'mermaid' | 'plantuml'>([
  ['mermaid', 'mermaid'],
  ['plantuml', 'plantuml'],
  ['puml', 'plantuml'],
]);

function diagramPlaceholder(kind: 'mermaid' | 'plantuml', source: string): Content {
  return {
    type: 'diagramPlaceholder',
    data: {
      hName: 'div',
      hProperties: {
        className: ['diagram-placeholder', `diagram-${kind}`],
        dataDiagram: kind,
        // base64 避免源码中的引号/换行污染 HTML 属性
        dataSource: Buffer.from(source, 'utf8').toString('base64'),
      },
    },
  } as unknown as Content;
}

function remarkDiagrams(options: { mermaid: boolean; plantuml: boolean }) {
  const transform = (parent: MdastParent) => {
    const next: Content[] = [];
    for (const child of parent.children as Content[]) {
      if (child.type === 'code') {
        const lang = (typeof child.lang === 'string' ? child.lang : '').trim().toLowerCase().split(/\s+/)[0];
        const kind = DIAGRAM_LANGS.get(lang);
        if (kind === 'mermaid' && options.mermaid) {
          next.push(diagramPlaceholder('mermaid', child.value));
          continue;
        }
        if (kind === 'plantuml' && options.plantuml) {
          next.push(diagramPlaceholder('plantuml', child.value));
          continue;
        }
      }
      if ('children' in child && Array.isArray((child as MdastParent).children)) {
        transform(child as MdastParent);
      }
      next.push(child);
    }
    parent.children = next;
  };

  return (tree: import('unist').Node) => {
    transform(tree as MdastRoot);
  };
}

// ═══════════════ 代码块标题（```lang title="a.ts"）═══════════════
// rehype-raw 会重建 hast 树，Expressive Code 依赖的 meta 信息会丢失，
// 因此提前把标题写进包裹元素的 data-code-title 属性，代码分组时再读取。
const CODE_TITLE_RE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|([^\s]+))/i;
const META_KEYWORDS = new Set(['showLineNumbers', 'collapse', 'wrap', 'lineNumbers']);

function extractCodeTitle(meta: unknown): string {
  if (typeof meta !== 'string' || !meta.trim()) return '';
  const matched = CODE_TITLE_RE.exec(meta);
  if (matched) return (matched[1] ?? matched[2] ?? matched[3] ?? '').trim();

  // 裸标题写法：```ts a.ts
  const bare = meta
    .trim()
    .split(/\s+/)
    .find((token) => token && !META_KEYWORDS.has(token) && !/^[\w-]+=/.test(token) && !token.startsWith('{'));
  return bare ?? '';
}

function remarkCodeTitles(options: { enabled: boolean }) {
  const transform = (parent: MdastParent) => {
    const next: Content[] = [];
    for (const child of parent.children as Content[]) {
      if (child.type === 'code') {
        const title = extractCodeTitle((child as { meta?: unknown }).meta);
        if (title) {
          next.push({
            type: 'codeBlockWrapper',
            data: {
              hName: 'div',
              hProperties: { className: ['code-block-wrapper'], dataCodeTitle: title },
            },
            children: [child],
          } as unknown as Content);
          continue;
        }
      }
      if ('children' in child && Array.isArray((child as MdastParent).children)) {
        transform(child as MdastParent);
      }
      next.push(child);
    }
    parent.children = next;
  };

  return (tree: import('unist').Node) => {
    if (!options.enabled) return;
    transform(tree as MdastRoot);
  };
}

// ═══════════════ rehype：还原 Mermaid / PlantUML ═══════════════
// PlantUML 需使用其自定义的 6bit base64 变体（不是标准 base64）
const PLANTUML_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

function encodePlantuml6bit(data: Buffer): string {
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < data.length ? data[i + 1] : 0;
    const b3 = i + 2 < data.length ? data[i + 2] : 0;
    result += PLANTUML_ALPHABET[(b1 >> 2) & 0x3f];
    result += PLANTUML_ALPHABET[(((b1 & 0x03) << 4) | (b2 >> 4)) & 0x3f];
    result += PLANTUML_ALPHABET[(((b2 & 0x0f) << 2) | (b3 >> 6)) & 0x3f];
    result += PLANTUML_ALPHABET[b3 & 0x3f];
  }
  return result;
}

function plantumlSvgUrl(source: string): string {
  const base = 'https://www.plantuml.com/plantuml/svg/';
  try {
    const deflated = deflateRawSync(Buffer.from(source, 'utf8'));
    return base + encodePlantuml6bit(deflated);
  } catch {
    // 退化方案：PlantUML 的 ~h 十六进制文本编码
    return `${base}~h${Buffer.from(source, 'utf8').toString('hex')}`;
  }
}

function decodeBase64(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function rehypeDiagrams() {
  return (tree: import('unist').Node) => {
    visit(tree as HastRoot, 'element', (node: HastElement, index: number | undefined, parent: any) => {
      if (!classNames(node).includes('diagram-placeholder')) return;
      if (!parent || typeof index !== 'number') return;

      const kind = String((node.properties as Record<string, unknown> | undefined)?.dataDiagram || '');
      const source = decodeBase64((node.properties as Record<string, unknown> | undefined)?.dataSource);

      let replacement: ElementContent;
      if (kind === 'mermaid') {
        replacement = {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['mermaid'] },
          children: source ? [{ type: 'text', value: source }] : [],
        };
      } else {
        replacement = {
          type: 'element',
          tagName: 'img',
          properties: {
            className: ['plantuml'],
            src: plantumlSvgUrl(source),
            alt: 'PlantUML',
            loading: 'lazy',
          },
          children: [],
        };
      }

      parent.children.splice(index, 1, replacement);
      return index;
    });
  };
}

// ═══════════════ rehype：代码分组（Tab / details 降级）═══════════════
function classNames(el: HastElement): string[] {
  const value = el.properties?.className as string[] | string | undefined;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function isCodeBlock(el: HastElement): boolean {
  const cls = classNames(el);
  if (cls.includes('code-block-wrapper')) return true;
  if (el.tagName === 'div') return cls.includes('expressive-code');
  // 未经 Expressive Code 处理的代码块（例如高亮失败时的降级）
  if (el.tagName === 'pre') return !cls.includes('mermaid');
  return false;
}

function summarizeCodeBlock(block: HastElement): string {
  // 优先使用 remark 阶段写入的标题（rehype-raw 之后 Expressive Code 的 meta 会丢失）
  const ownTitle = (block.properties as Record<string, unknown> | undefined)?.dataCodeTitle;
  if (typeof ownTitle === 'string' && ownTitle) return ownTitle;

  // Expressive Code 会把 ```lang title 的 title 放进 figcaption > .title
  let title = '';
  visit(block, 'element', (node: any) => {
    if (!title && node.tagName === 'span' && classNames(node).includes('title')) {
      title = hastText(node).trim();
    }
  });
  if (title) return title;

  let lang = '';
  visit(block, 'element', (node: any) => {
    if (!lang && node.tagName === 'pre' && typeof node.properties?.dataLanguage === 'string') {
      lang = node.properties.dataLanguage;
    }
  });
  return lang || '代码';
}

function hastText(node: HastElement): string {
  let text = '';
  visit(node, (child: any) => {
    if (child.type === 'text') text += child.value;
  });
  return text;
}

function codeTabDetails(block: HastElement, index: number): HastElement {
  const properties: Properties = { className: ['code-group-item'] };
  if (index === 0) properties.open = true;
  return {
    type: 'element',
    tagName: 'details',
    properties,
    children: [
      {
        type: 'element',
        tagName: 'summary',
        properties: { className: ['code-group-tab'] },
        children: [{ type: 'text', value: summarizeCodeBlock(block) }],
      },
      block,
    ],
  };
}

/**
 * 把同一父节点下连续的代码块合并为 code-group。
 * wrap=true 时额外包一层 div.code-group；显式 :::code-group 容器不需要再包一层。
 * 只有连续出现 ≥2 个代码块才会分组，单个代码块保持原样。
 */
function groupCodeBlocks(parent: HastRoot | HastElement, wrap: boolean): void {
  const children = parent.children as ElementContent[];
  const next: ElementContent[] = [];
  let run: HastElement[] = [];

  const flush = () => {
    if (run.length >= 2) {
      const items = run.map((block, i) => codeTabDetails(block, i));
      if (wrap) {
        next.push({
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-group'], dataTabs: 'true' },
          children: items,
        });
      } else {
        next.push(...items);
      }
    } else {
      next.push(...run);
    }
    run = [];
  };

  for (const child of children) {
    if (child.type === 'element' && isCodeBlock(child)) {
      run.push(child);
      continue;
    }
    // 代码块之间的空白文本直接吞掉，不影响分组
    if (run.length > 0 && child.type === 'text' && !child.value.trim()) continue;
    flush();
    next.push(child);
  }
  flush();

  parent.children = next as typeof parent.children;
}

function rehypeCodeGroups(options: { enabled: boolean }) {
  return (tree: import('unist').Node) => {
    if (!options.enabled) return;
    const root = tree as HastRoot;

    // ① 显式 :::code-group 容器：直接在其内部把连续代码块变成 details
    visit(root, 'element', (node: any) => {
      if (node.tagName === 'div' && classNames(node).includes('code-group')) {
        groupCodeBlocks(node, false);
      }
    });

    // ② 其余容器中的相邻代码块（连续 ≥2 个）自动分组
    visit(root, 'element', (node: any) => {
      if (node.tagName === 'pre' || node.tagName === 'code' || node.tagName === 'details') return;
      const cls = classNames(node);
      if (cls.includes('code-group') || cls.includes('code-group-item') || cls.includes('expressive-code')) return;
      groupCodeBlocks(node, true);
    });

    groupCodeBlocks(root, true);
  };
}

// ═══════════════ rehype：图片 figure 包裹 ═══════════════
function rehypeFigures() {
  return (tree: import('unist').Node) => {
    visit(tree as HastRoot, 'element', (node: any, index: number | undefined, parent: any) => {
      if (!parent || typeof index !== 'number') return;
      if (node.tagName !== 'p') return;

      // 只处理“段落里仅有图片（可被链接包裹）”的情况，带文字的图片保持行内
      const meaningful = (node.children as ElementContent[]).filter(
        (child) => !(child.type === 'text' && !child.value.trim()),
      );
      if (meaningful.length !== 1) return;

      const only = meaningful[0];
      let img: HastElement | null = null;
      if (only.type === 'element' && only.tagName === 'img') {
        img = only;
      } else if (only.type === 'element' && only.tagName === 'a') {
        const inner = (only.children as ElementContent[]).filter(
          (child) => !(child.type === 'text' && !child.value.trim()),
        );
        if (inner.length === 1 && inner[0].type === 'element' && inner[0].tagName === 'img') {
          img = inner[0];
        }
      }
      if (!img) return;

      const alt = typeof img.properties?.alt === 'string' ? img.properties.alt : '';
      const figure: HastElement = {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['markdown-figure'] },
        children: [only],
      };
      if (alt.trim()) {
        figure.children.push({
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [{ type: 'text', value: alt }],
        });
      }

      parent.children.splice(index, 1, figure);
      return index;
    });
  };
}

// ═══════════════ 管线构建（按开关组合缓存）═══════════════
const processorCache = new Map<string, ReturnType<typeof buildProcessor>>();

interface PipelineFlags {
  callouts: boolean;
  wikiLink: boolean;
  emailProtection: boolean;
  sectionize: boolean;
  codeTabGroup: boolean;
  figure: boolean;
  mermaid: boolean;
  plantuml: boolean;
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

  // ::: 指令容器（admonition / code-group）
  p.use(remarkDirective)
    .use(remarkAdmonitions, { codeTabGroup: flags.codeTabGroup })
    .use(remarkDiagrams, { mermaid: flags.mermaid, plantuml: flags.plantuml })
    .use(remarkCodeTitles, { enabled: flags.codeTabGroup });

  // 按标题把正文拆成 <section>
  if (flags.sectionize) {
    p.use(remarkSectionize);
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

  // 图表占位还原（必须在 Expressive Code 之后，避免被高亮）
  p.use(rehypeDiagrams);

  // 代码分组（Expressive Code 渲染完成后才合并，失败时保持原结构）
  p.use(rehypeCodeGroups, { enabled: flags.codeTabGroup });

  // 图片 figure 包裹
  if (flags.figure) {
    p.use(rehypeFigures);
  }

  p.use(...([rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }] as [typeof rehypeExternalLinks, ExternalLinksOptions]));

  // 邮箱保护（放在外链处理之后，避免影响正常链接）
  if (flags.emailProtection) {
    p.use(rehypeEmailProtection);
  }

  // 说明：文章内容不做 sanitize。Expressive Code 的内联 <style>/<script>、
  // KaTeX MathML、callout/figure/admonition 结构过于复杂，白名单清洗极易破坏高亮。
  // 用户生成的评论内容改走 renderCommentMarkdown（见 lib/markdown/comment.ts），
  // 那里使用严格白名单清洗。
  return p.use(rehypeStringify);
}

// 缓存 key 必须覆盖全部开关，否则切换设置后会命中旧管线
function processorKey(flags: PipelineFlags): string {
  return [
    flags.callouts ? 'c' : '-',
    flags.wikiLink ? 'w' : '-',
    flags.emailProtection ? 'e' : '-',
    flags.sectionize ? 's' : '-',
    flags.codeTabGroup ? 'g' : '-',
    flags.figure ? 'f' : '-',
    flags.mermaid ? 'm' : '-',
    flags.plantuml ? 'p' : '-',
  ].join('');
}

function getProcessor(flags: PipelineFlags) {
  const key = processorKey(flags);
  if (!processorCache.has(key)) {
    processorCache.set(key, buildProcessor(flags));
  }
  return processorCache.get(key)!;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderMarkdown(content: string): Promise<string> {
  // ① 插件先预处理 Markdown（onRenderMarkdown 扩展点）
  let processed = typeof content === 'string' ? content : '';
  try {
    const results = await fireExtensionPoint('onRenderMarkdown', processed);
    for (const r of results) {
      if (typeof r === 'string') processed = r;
    }
  } catch { /* 插件系统未就绪时直接渲染 */ }

  // ② 站点开关 → 选择管线（读取失败时用默认组合）
  let flags: PipelineFlags = {
    callouts: true,
    wikiLink: false,
    emailProtection: true,
    sectionize: false,
    codeTabGroup: true,
    figure: true,
    mermaid: false,
    plantuml: false,
  };
  try {
    const site = await getSiteSetting();
    flags = {
      callouts: site.enableCallouts,
      wikiLink: site.enableWikiLink,
      emailProtection: site.enableEmailProtection,
      sectionize: site.enableSectionize,
      codeTabGroup: site.codeTabGroup,
      figure: site.enableFigure,
      mermaid: site.enableMermaid,
      plantuml: site.enablePlantuml,
    };
  } catch { /* 数据库未就绪 */ }

  // ③ 指令标题归一化（`:::tip 标题` → `:::tip[标题]`）
  try {
    processed = normalizeDirectiveTitles(processed);
  } catch { /* 预处理失败时按原样解析 */ }

  // ④ unified 管线渲染为 HTML；任何异常都降级为转义后的原文，避免页面 500
  try {
    const result = await getProcessor(flags).process(processed);
    return String(result);
  } catch {
    return `<pre class="markdown-fallback">${escapeHtml(processed)}</pre>`;
  }
}

// 阅读时间与评论渲染分别位于独立模块，这里统一导出方便调用方使用
export { estimateReadingTime } from './reading-time';
export { renderCommentMarkdown } from './comment';
