// components/post/TableOfContents.tsx — 文章目录（DOMParser 提取 h2/h3 + IntersectionObserver 高亮）
'use client';

import { useEffect, useState } from 'react';
import { ListTree, ChevronDown } from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export default function TableOfContents({
  html,
  variant = 'desktop',
}: {
  html: string;
  /** desktop：文章右侧固定目录（lg 以上显示）；mobile：可展开面板（lg 以下显示） */
  variant?: 'desktop' | 'mobile';
}) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [mobileOpen, setMobileOpen] = useState(false);

  // 从 html 字符串提取标题，并确保正文 DOM 中的标题带 id（缺省时回填 toc-N）
  useEffect(() => {
    if (!html) return;

    // 1. DOMParser 解析静态 html 生成目录数据
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const parsed = Array.from(doc.querySelectorAll('h2, h3'));
    if (parsed.length === 0) return;

    const used = new Set<string>();
    const list: TocItem[] = parsed.map((h, i) => {
      let id = h.id || '';
      if (!id || used.has(id)) id = `toc-${i}`;
      used.add(id);
      return {
        id,
        text: (h.textContent || '').trim(),
        level: h.tagName === 'H2' ? 2 : 3,
      };
    });

    // 2. 回填：正文 DOM 中缺失 id 的标题按同样规则补齐，保证锚点可跳转
    const domHeads = Array.from(document.querySelectorAll('.markdown-body h2, .markdown-body h3'));
    const domUsed = new Set<string>();
    domHeads.forEach((h, i) => {
      let id = h.id;
      if (!id || domUsed.has(id)) {
        id = `toc-${i}`;
        while (domUsed.has(id)) id += '-x';
        h.id = id;
      }
      domUsed.add(id);
    });

    setItems(list);
  }, [html]);

  // 滚动高亮当前章节
  useEffect(() => {
    if (items.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = items.find((it) => visible.has(it.id));
        if (first) setActiveId(first.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  function jump(e: React.MouseEvent, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    if (variant === 'mobile') setMobileOpen(false);
  }

  if (items.length === 0) return null;

  const linkClass = (item: TocItem, active: boolean) =>
    `block truncate py-1 text-sm transition-all duration-200 border-l-2 ${
      active
        ? 'border-primary text-primary font-medium pl-3'
        : 'border-transparent text-fg-muted hover:text-fg hover:border-line pl-3'
    } ${item.level === 3 ? 'ml-4' : ''}`;

  const list = (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <li key={item.id} className="anim-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
          <a
            href={`#${item.id}`}
            onClick={(e) => jump(e, item.id)}
            className={linkClass(item, item.id === activeId)}
            title={item.text}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );

  if (variant === 'mobile') {
    return (
      <div className="lg:hidden rounded-lg border border-line bg-bg overflow-hidden anim-fade-in-up">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold transition-colors duration-200 hover:bg-bg-secondary active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2">
            <ListTree className="w-4 h-4 text-primary" />
            目录
          </span>
          <ChevronDown className={`w-4 h-4 text-fg-muted transition-transform duration-300 ${mobileOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileOpen && (
          <div className="max-h-72 overflow-y-auto px-3 pb-3 anim-fade-in">{list}</div>
        )}
      </div>
    );
  }

  return (
    <nav aria-label="目录" className="hidden lg:block anim-fade-in">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
        <ListTree className="w-4 h-4 text-primary" />
        目录
      </p>
      <div className="max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">{list}</div>
    </nav>
  );
}
