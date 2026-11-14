// components/admin/MilkdownEditor.tsx — Milkdown 可视化 Markdown 编辑器（所见即所得）
// vanilla 挂载：defaultValueCtx 设初值，listener markdownUpdated 同步回父组件
'use client';

import { useEffect, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let disposed = false;
    let editorInstance: Editor | null = null;

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
      <div ref={rootRef} />
    </div>
  );
}
