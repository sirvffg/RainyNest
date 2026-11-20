// components/admin/MilkdownEditor.tsx — Milkdown 可视化 Markdown 编辑器（所见即所得）
// 粘贴纯 Markdown 自动解析为结构节点，避免 ProseMirror 全量转义
'use client';

import { useEffect, useRef, useState } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { looksLikeMarkdown, markdownToHtml } from '@/lib/markdown/paste-convert';
import '@milkdown/kit/prose/view/style/prosemirror.css';

export default function MilkdownEditor({
  value,
  onChange,
  minHeight = 420,
}: {
  value: string;
  onChange: (markdown: string) => void;
  minHeight?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [actions, setActions] = useState<EditorAction[]>([]);

  // 插件 editorCreate 扩展点：加载自定义工具按钮
  useEffect(() => {
    fetch('/api/plugin/editor-actions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setActions(Array.isArray(d?.list) ? d.list : []))
      .catch(() => { /* 忽略 */ });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let disposed = false;
    let editorInstance: Editor | null = null;

    // ── 粘贴拦截：纯 Markdown → HTML，让 ProseMirror 解析为节点结构 ──
    const handlePaste = async (e: ClipboardEvent) => {
      const plain = e.clipboardData?.getData('text/plain');
      if (!plain || !looksLikeMarkdown(plain)) return;
      // 已有 HTML 版本（从富文本复制过来）就不走我们的转换
      if (e.clipboardData?.types.includes('text/html')) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        const html = await markdownToHtml(plain);
        // 用原生方法把 HTML 插入到 contenteditable（Milkdown 底层是 ProseMirror contenteditable）
        // 先聚焦确保插入位置正确
        const active = document.activeElement as HTMLElement | null;
        if (active?.isContentEditable) {
          document.execCommand('insertHTML', false, html);
        }
      } catch (err) {
        console.warn('[Milkdown] Markdown paste fallback failed:', err);
      }
    };

    // capture 阶段拦截，比 ProseMirror 自己的 paste handler 早
    root.addEventListener('paste', handlePaste, true);

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .create()
      .then((editor) => {
        if (disposed) editor.destroy();
        else editorInstance = editor;
      })
      .catch(() => {
        // Milkdown 初始化失败时容器保持空白 父组件仍持有原文本
      });

    return () => {
      disposed = true;
      root.removeEventListener('paste', handlePaste, true);
      try {
        editorInstance?.destroy();
      } catch {
        // 已销毁
      }
    };
    // 仅在挂载时创建一次，内容初值用 defaultValueCtx，编辑过程走 onChange 回流
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="milkdown-editor-wrapper rounded border border-line bg-bg transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-500/20"
      style={{ minHeight }}
    >
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
          {actions.map((a) => (
            <button
              key={`${a.pluginSlug}:${a.key}`}
              type="button"
              title={a.shortcut ? `${a.label}（${a.shortcut}）` : a.label}
              onClick={() => runEditorAction(a)}
              className="rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-secondary hover:text-primary"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div ref={rootRef} />
    </div>
  );
}

type EditorAction = {
  pluginSlug: string;
  key: string;
  label: string;
  insert?: string;
  wrap?: [string, string];
  shortcut?: string;
};

// 基于 execCommand 的轻量插入；插件按钮本质是 Markdown 片段注入
function runEditorAction(action: EditorAction) {
  const selection = window.getSelection()?.toString() ?? '';
  let text = action.insert ? action.insert.replace('{selection}', selection) : selection;
  if (action.wrap) text = `${action.wrap[0]}${selection}${action.wrap[1]}`;
  if (!text) return;
  const active = document.activeElement as HTMLElement | null;
  if (active?.isContentEditable) {
    document.execCommand('insertText', false, text);
  }
}
