// lib/plugin/admin.ts — 插件后台导航项收集（服务端）
// 汇总所有已加载插件的 customAdminRoutes，供 ConsoleShell 渲染「插件」菜单组
import 'server-only';
import { bootPlugins, getLoadedPlugins } from './engine';

export interface PluginNavItem {
  slug: string;
  pluginName: string;
  path: string;
  title: string;
  href: string;
  // 归入的后台侧栏分组：内置分组名（总览/内容/站点/系统/工具）或自定义新分组名；缺省进「插件」组
  group?: string;
}

export async function getPluginNavItems(): Promise<PluginNavItem[]> {
  try {
    await bootPlugins();
  } catch {
    return []; // 插件系统未就绪（构建期等）→ 无扩展菜单
  }

  const items: PluginNavItem[] = [];
  for (const plugin of getLoadedPlugins()) {
    for (const route of plugin.handlers.customAdminRoutes ?? []) {
      items.push({
        slug: plugin.slug,
        pluginName: plugin.meta.name,
        path: route.path,
        title: route.title,
        href: `/console/plugin-ext/${plugin.slug}/${route.path}`,
        group: route.group,
      });
    }
  }
  return items;
}
