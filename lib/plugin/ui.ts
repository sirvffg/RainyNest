// lib/plugin/ui.ts — 插件 UI 类扩展点收集（服务端渲染为静态 HTML / 数据）
// 插件组件不在 Next RSC 模块图内，统一走 renderToStaticMarkup
import 'server-only';
import type { ReactNode } from 'react';
import { bootPlugins, getLoadedPlugins, fireExtensionPoint, collectPluginDefinitions } from './engine';
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
  return collectListOperations('postListItemOperation');
}

// 通用列表行操作收集（文章/页面/评论/回复/插件/主题/附件/备份）
export type ListOperationPoint =
  | 'postListItemOperation'
  | 'pageListItemOperation'
  | 'commentListItemOperation'
  | 'replyListItemOperation'
  | 'pluginListItemOperation'
  | 'themeListItemOperation'
  | 'attachmentListItemOperation'
  | 'backupListItemOperation';

export async function collectListOperations(point: ListOperationPoint): Promise<PluginPostOperation[]> {
  try {
    const defs = await collectPluginDefinitions(point);
    return defs.map(({ pluginSlug, def }) => ({
      slug: pluginSlug,
      label: (def as ListItemOperationDef).label,
      icon: (def as ListItemOperationDef).icon,
      variant: (def as ListItemOperationDef).variant ?? 'default',
      hrefTemplate: (def as ListItemOperationDef).onClick ?? '',
    }));
  } catch {
    return [];
  }
}

// ── injectHeaderAction：顶栏按钮（返回结构化数据，由 Header 渲染）──
export async function collectHeaderActions(): Promise<
  { pluginSlug: string; key: string; label: string; icon?: string; href?: string; order: number }[]
> {
  try {
    const defs = await collectPluginDefinitions('injectHeaderAction');
    return defs
      .map(({ pluginSlug, def }) => ({
        pluginSlug,
        key: def.key,
        label: def.label,
        icon: def.icon,
        href: def.href,
        order: def.order ?? 0,
      }))
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

// ── injectSinglePageContent：独立页面底部追加块 ──
export async function collectSinglePageContentHtml(): Promise<string[]> {
  try {
    await bootPlugins();
    const blocks: string[] = [];
    for (const plugin of getLoadedPlugins()) {
      for (const comp of plugin.handlers.injectSinglePageContent?.() ?? []) {
        try {
          blocks.push(await renderComponentHtml(comp));
        } catch (err) {
          console.error(`[Plugin] ${plugin.slug} injectSinglePageContent failed:`, err);
        }
      }
    }
    return blocks;
  } catch {
    return [];
  }
}

// ── injectCommentField：评论表单额外字段（结构化，前端动态渲染）──
export async function collectCommentFields(): Promise<import('./types').CommentFieldDef[]> {
  try {
    const defs = await collectPluginDefinitions('injectCommentField');
    return defs.flatMap(({ def }) => (Array.isArray(def) ? def : [def]));
  } catch {
    return [];
  }
}

// ── editorCreate：编辑器工具按钮（结构化，前端渲染）──
export async function collectEditorActions(): Promise<
  (import('./types').EditorActionDef & { pluginSlug: string })[]
> {
  try {
    const defs = await collectPluginDefinitions('editorCreate');
    return defs.flatMap(({ pluginSlug, def }) =>
      (Array.isArray(def) ? def : [def]).map((d) => ({ ...d, pluginSlug }))
    );
  } catch {
    return [];
  }
}

// ── dashboardQuickAction：仪表盘快捷入口 ──
export async function collectQuickActions(): Promise<import('./types').QuickActionDef[]> {
  try {
    const defs = await collectPluginDefinitions('dashboardQuickAction');
    return defs.flatMap(({ def }) => (Array.isArray(def) ? def : [def]));
  } catch {
    return [];
  }
}

// ── 列表字段列（文章/页面/插件）──
export interface ResolvedListField {
  pluginSlug: string;
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
  render: (item: Record<string, any>) => unknown;
}

export type ListFieldPoint = 'postListItemField' | 'pageListItemField' | 'pluginListItemField';

export async function collectListFields(point: ListFieldPoint): Promise<ResolvedListField[]> {
  try {
    const defs = await collectPluginDefinitions(point);
    return defs.map(({ pluginSlug, def }) => ({
      pluginSlug,
      key: def.key,
      label: def.label,
      width: def.width,
      sortable: def.sortable,
      render: def.render,
    }));
  } catch {
    return [];
  }
}

// 渲染一行插件字段值（失败时留空，不影响主表格）
export async function renderListFieldValues(
  fields: ResolvedListField[],
  item: Record<string, any>
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    try {
      const v = await field.render(item);
      out[field.key] = v === null || v === undefined ? '' : String(v);
    } catch {
      out[field.key] = '';
    }
  }
  return out;
}

// ── Tab 注入（插件详情/主题列表/附件选择器/插件安装/备份/用户详情）──
export type TabPoint =
  | 'pluginDetailTab'
  | 'themeListTab'
  | 'attachmentSelectorTab'
  | 'pluginInstallTab'
  | 'backupTab'
  | 'userDetailTab';

export interface RenderedTab {
  pluginSlug: string;
  key: string;
  label: string;
  icon?: string;
  html: string;
}

export async function collectTabs(point: TabPoint): Promise<RenderedTab[]> {
  try {
    const defs = await collectPluginDefinitions(point);
    const tabs: RenderedTab[] = [];
    for (const { pluginSlug, def } of defs) {
      try {
        tabs.push({
          pluginSlug,
          key: def.key,
          label: def.label,
          icon: def.icon,
          html: await renderComponentHtml(def.component),
        });
      } catch (err) {
        console.error(`[Plugin] ${pluginSlug} ${point} render failed:`, err);
      }
    }
    return tabs;
  } catch {
    return [];
  }
}

// ── 评论编辑器 / 评论内容渲染替换（第一个提供者生效）──
export async function getCommentEditorHtml(): Promise<string | null> {
  try {
    await bootPlugins();
    for (const plugin of getLoadedPlugins()) {
      const comp = plugin.handlers.commentEditorReplace?.();
      if (comp) {
        try {
          return await renderComponentHtml(comp);
        } catch (err) {
          console.error(`[Plugin] ${plugin.slug} commentEditorReplace failed:`, err);
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

export async function getCommentContentRendererHtml(): Promise<string | null> {
  try {
    await bootPlugins();
    for (const plugin of getLoadedPlugins()) {
      const comp = plugin.handlers.commentListItemContentReplace?.();
      if (comp) {
        try {
          return await renderComponentHtml(comp);
        } catch (err) {
          console.error(`[Plugin] ${plugin.slug} commentListItemContentReplace failed:`, err);
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ── commentSubjectRef：评论来源展示方式 ──
export async function collectCommentSubjectRefs(): Promise<
  import('./types').CommentSubjectRefDef[]
> {
  try {
    const defs = await collectPluginDefinitions('commentSubjectRef');
    return defs.flatMap(({ def }) => (Array.isArray(def) ? def : [def]));
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
