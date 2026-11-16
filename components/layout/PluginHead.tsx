// components/layout/PluginHead.tsx — 插件 injectHead 扩展点 → 渲染进 <head>
// 插件返回 string（如 <meta>/<style>）或 ReactNode；字符串按标签解析为真实 React 元素
import { Fragment } from 'react';
import { fireExtensionPoint } from '@/lib/plugin/engine';

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

function HeadItem({ html }: { html: string }) {
  const styleMatch = html.match(/^<style([^>]*)>([\s\S]*?)<\/style>\s*$/);
  if (styleMatch) {
    return <style {...parseAttrs(styleMatch[1])} dangerouslySetInnerHTML={{ __html: styleMatch[2] }} />;
  }
  const scriptMatch = html.match(/^<script([^>]*)>([\s\S]*?)<\/script>\s*$/);
  if (scriptMatch) {
    return <script {...parseAttrs(scriptMatch[1])} dangerouslySetInnerHTML={{ __html: scriptMatch[2] }} />;
  }
  const metaMatch = html.match(/^<meta\s+([^>]*?)\/?>\s*$/);
  if (metaMatch) {
    return <meta {...parseAttrs(metaMatch[1])} />;
  }
  const linkMatch = html.match(/^<link\s+([^>]*?)\/?>\s*$/);
  if (linkMatch) {
    return <link {...parseAttrs(linkMatch[1])} />;
  }
  // 无法识别的标签（含 HTML 注释）：忽略（避免把原始 HTML 字符串塞进 head）
  return null;
}

export default async function PluginHead() {
  let items: (string | React.ReactNode)[] = [];
  try {
    items = await fireExtensionPoint('injectHead');
  } catch {
    // 插件系统未就绪 → 不注入
  }
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item, i) => {
        // 兼容插件返回字符串数组（如按行拆分的 CSS 片段）
        const html = Array.isArray(item)
          ? item.filter((s) => typeof s === 'string').join('\n')
          : item;
        if (typeof html === 'string') return <HeadItem key={i} html={html} />;
        return <Fragment key={i}>{html}</Fragment>;
      })}
    </>
  );
}
