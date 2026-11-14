// lib/plugin/ui.ts — 插件 UI 类扩展点收集（服务端渲染为静态 HTML / 数据）
// 插件组件不在 Next RSC 模块图内，统一走 renderToStaticMarkup
import 'server-only';
import type { ReactNode } from 'react';
import { bootPlugins, getLoadedPlugins, fireExtensionPoint } from './engine';
import type { ListItemOperationDef } from './types';

// Turbopack 禁止 RSC 静态 import react-dom/server → 运行时 require 绕过
const { renderToStaticMarkup } = process
  .getBuiltinModule('node:module')
  .createRequire(process.cwd() + '/package.json')('react-dom/server') as {
  renderToStaticMarkup: (node: ReactNode) => string;
};

// 从各种形态中提取组件函数：ComponentType / async 组件 / 模块对象 / ESM 互操作
function extractComponent(input: unknown): ((props?: Record<string, unknown>) => unknown) | null {
  if (typeof input === 'function') return input as (props?: Record<string, unknown>) => unknown;
  const d = (input as { default?: unknown })?.default;
  if (typeof d === 'function') return d as (props?: Record<string, unknown>) => unknown;
  const dd = (d as { default?: unknown })?.default;
  if (typeof dd === 'function') return dd as (props?: Record<string, unknown>) => unknown;
  return null;
}

// 统一渲染入口，兼容三种传入形态：
// ① ComponentType / async 组件（闭包写法，可直接读插件库）
// ② () => Promise<{ default: ComponentType }>（模块动态 import）
// ③ () => ComponentType（工厂返回组件）
// ④ ReactElement（直接元素）
export async function renderComponentHtml(input: unknown): Promise<string> {
  let Comp = extractComponent(input);

  if (typeof input === 'function') {
    try {
      const out = (input as () => unknown)();
      if (out instanceof Promise) {
        Comp = extractComponent(await out); // 形态②
      } else if (out && typeof out === 'object' && (out as { $$typeof?: symbol }).$$typeof) {
        return renderToStaticMarkup(out as ReactNode); // 形态④
      } else if (typeof out === 'function') {
        Comp = out as (props?: Record<string, unknown>) => unknown; // 形态③
      }
    } catch { /* 形态①：组件调用失败则当组件本身用 */ }
  }

  if (!Comp) throw new Error('无法从插件导出中解析组件');
  const node = await Comp({});
  if (node === null || node === undefined) return '';
  return renderToStaticMarkup(node as ReactNode);
}

// ── injectFooter：页脚注入（字符串或 ReactNode）──
export async function collectInjectFooter(): Promise<(string | ReactNode)[]> {
  try {
    await bootPlugins();
    const results = await fireExtensionPoint('injectFooter');
    return results.flat() as (string | ReactNode)[];
  } catch {
    return [];
  }
}

// ── injectPostContent：文章详情底部追加块（渲染为 HTML）──
export async function collectPostContentHtml(): Promise<string[]> {
  try {
    await bootPlugins();
    const blocks: string[] = [];
    for (const plugin of getLoadedPlugins()) {
      for (const comp of plugin.handlers.injectPostContent?.() ?? []) {
        try {
          blocks.push(await renderComponentHtml(comp));
        } catch (err) {
          console.error(`[Plugin] ${plugin.slug} injectPostContent failed:`, err);
        }
      }
    }
    return blocks;
  } catch {
    return [];
  }
}

// ── injectCommentWidget：第三方评论替换（第一个提供者生效）──
export async function getCommentWidgetHtml(): Promise<string | null> {
  try {
    await bootPlugins();
    for (const plugin of getLoadedPlugins()) {
      const comp = plugin.handlers.injectCommentWidget?.();
      if (comp) {
        try {
          return await renderComponentHtml(comp);
        } catch (err) {
          console.error(`[Plugin] ${plugin.slug} injectCommentWidget failed:`, err);
        }
      }
    }
  } catch { /* 插件系统未就绪 */ }
  return null;
}

// ── postListItemOperation：文章列表行操作按钮（降级为链接型）──
// onClick 字段用作 href 模板，支持 {id} {slug} 占位符
export interface PluginPostOperation {
  slug: string;
  label: string;
  icon?: string;
  variant: 'default' | 'ghost' | 'outline';
  hrefTemplate: string;
}

export async function collectPostOperations(): Promise<PluginPostOperation[]> {
  try {
    await bootPlugins();
    const ops: PluginPostOperation[] = [];
    for (const plugin of getLoadedPlugins()) {
      for (const def of plugin.handlers.postListItemOperation ?? []) {
        ops.push({
          slug: plugin.slug,
          label: def.label,
          icon: def.icon,
          variant: def.variant ?? 'default',
          hrefTemplate: def.onClick ?? '',
        });
      }
    }
    return ops;
  } catch {
    return [];
  }
}

// ── dashboardWidget：仪表盘卡片（服务端渲染为 HTML + 元信息）──
export interface PluginDashboardWidget {
  slug: string;
  title: string;
  icon?: string;
  colSpan: number;
  html: string;
}

export async function collectDashboardWidgets(): Promise<PluginDashboardWidget[]> {
  try {
    await bootPlugins();
    const widgets: PluginDashboardWidget[] = [];
    for (const plugin of getLoadedPlugins()) {
      for (const def of plugin.handlers.dashboardWidget ?? []) {
        try {
          widgets.push({
            slug: plugin.slug,
            title: def.title,
            icon: def.icon,
            colSpan: def.colSpan ?? 1,
            html: await renderComponentHtml(def.component),
          });
        } catch (err) {
          console.error(`[Plugin] ${plugin.slug} dashboardWidget failed:`, err);
        }
      }
    }
    return widgets;
  } catch {
    return [];
  }
}
