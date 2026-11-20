// components/markdown/MermaidRenderer.tsx — 客户端渲染 .mermaid 图表
// 仅在页面存在 mermaid 占位节点时按需加载 Mermaid ESM（CDN），失败时保留源码。
'use client';

import { useEffect } from 'react';

let loading: Promise<unknown> | null = null;

function loadMermaid(): Promise<unknown> {
  if (loading) return loading;
  loading = (async () => {
    const mod: any = await import(
      /* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs' as string
    ).catch(() => null);
    if (!mod) return null;
    const mermaid = mod.default ?? mod;
    mermaid.initialize?.({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });
    return mermaid;
  })();
  return loading;
}

export default function MermaidRenderer() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])'));
    if (nodes.length === 0) return;

    let cancelled = false;
    loadMermaid().then(async (mermaid: any) => {
      if (cancelled || !mermaid?.run) return;
      try {
        for (const node of nodes) {
          node.dataset.processed = 'true';
        }
        await mermaid.run({ nodes });
      } catch (err) {
        console.error('[Mermaid] 渲染失败:', err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
