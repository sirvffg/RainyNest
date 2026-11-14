// lib/plugin/engine.ts — 插件加载与扩展点执行引擎
// 扫描 vendor/plugins → 从预编译产物加载 → 按扩展点分组 → 执行
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../prisma';
import { analytics } from '../analytics';
import { getSiteSetting } from '../site';
import { getPluginDb } from '../plugin-db';
import type {
  ExtensionHandlers,
  LoadedPlugin,
  PluginContext,
  PluginLogger,
} from './types';

const PLUGINS_DIR = path.join(process.cwd(), 'vendor', 'plugins');
// ⭐ 运行时从预编译目录加载，不是 vendor/ 源码目录
const COMPILED_DIR = path.join(process.cwd(), '.vendor-compiled', 'plugins');

// ⭐ process.getBuiltinModule 运行时取模块，绕过 Turbopack 对 createRequire(计算路径) 的静态分析告警
const nodeRequire = process.getBuiltinModule('node:module').createRequire(
  path.join(process.cwd(), 'package.json')
);

const g = globalThis as unknown as {
  __rnPlugins?: LoadedPlugin[] | null;
  __rnPluginBooting?: Promise<void> | null;
};

function createPluginLogger(slug: string): PluginLogger {
  const p = `[Plugin:${slug}]`;
  return {
    info: (...args) => console.log(p, ...args),
    warn: (...args) => console.warn(p, ...args),
    error: (...args) => console.error(p, ...args),
  };
}

// 事件总线（进程内，简单实现）
const eventHandlers = new Map<string, ((data: unknown) => void)[]>();
function emitEvent(name: string, data: unknown) {
  for (const fn of eventHandlers.get(name) || []) {
    try { fn(data); } catch { /* ignore */ }
  }
}

// 扫描 + 加载所有插件（启动时调用一次）
export async function bootPlugins(): Promise<void> {
  if (g.__rnPluginBooting) return g.__rnPluginBooting;
  g.__rnPluginBooting = (async () => {
    const plugins: LoadedPlugin[] = [];

    if (fs.existsSync(PLUGINS_DIR)) {
      const dirs = fs.readdirSync(PLUGINS_DIR).filter((d) =>
        fs.statSync(path.join(PLUGINS_DIR, d)).isDirectory()
      );

      for (const dir of dirs) {
        const jsonPath = path.join(PLUGINS_DIR, dir, 'plugin.json');
        if (!fs.existsSync(jsonPath)) continue;

        let meta: import('./types').PluginMeta;
        try {
          meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        } catch (err) {
          console.error(`[Plugin] ${dir}: plugin.json 解析失败`, err);
          continue;
        }

        let dbEntry = null;
        try {
          dbEntry = await db.plugin.findUnique({ where: { slug: dir } });
        } catch { /* DB 未就绪 */ }
        if (dbEntry && !dbEntry.isActive) continue; // 数据库禁用的跳过

        try {
          const entryFile = (meta.entry || 'index.ts').replace('.ts', '.js');
          const compiledEntry = path.join(COMPILED_DIR, dir, entryFile);
          if (!fs.existsSync(compiledEntry)) {
            console.error(`[Plugin] ${dir}: 预编译产物不存在，请运行 npm run reload:vendor`);
            continue;
          }

          const mod = nodeRequire(compiledEntry);
          const ctx: PluginContext = {
            db,
            analytics,
            pluginDb: getPluginDb(dir),
            slug: dir,
            version: meta.version,
            config: dbEntry?.config ? JSON.parse(dbEntry.config) : {},
            site: await getSiteSetting(),
            env: process.env,
            logger: createPluginLogger(dir),
            emitEvent,
          };

          const handlers: ExtensionHandlers =
            typeof mod.default === 'function' ? mod.default(ctx) : {};

          plugins.push({ slug: dir, meta, handlers, enabled: true, config: ctx.config });
        } catch (err) {
          console.error(`[Plugin] Failed to load ${dir}:`, err);
        }
      }
    }

    g.__rnPlugins = plugins;

    // 执行 onMount
    for (const p of plugins) {
      if (p.handlers.onMount) {
        try {
          await p.handlers.onMount({
            db,
            analytics,
            pluginDb: getPluginDb(p.slug),
            site: await getSiteSetting(),
            slug: p.slug,
            version: p.meta.version,
            config: p.config,
            env: process.env,
            logger: createPluginLogger(p.slug),
            emitEvent,
          });
        } catch (err) {
          console.error(`[Plugin] ${p.slug} onMount failed:`, err);
        }
      }
    }

    if (plugins.length > 0) {
      console.log(`[Plugin] ✓ Loaded ${plugins.length} plugin(s): ${plugins.map((p) => p.slug).join(', ')}`);
    }
  })();

  try {
    await g.__rnPluginBooting;
  } finally {
    g.__rnPluginBooting = null;
  }
}

// 开发模式热重载（npm run reload:vendor 后调用）
export function resetPluginCache() {
  g.__rnPlugins = null;
}

// 函数类扩展点 key（searchProvider 等对象型扩展点单独处理）
type FnExtensionKeys = {
  [K in keyof ExtensionHandlers]-?: NonNullable<ExtensionHandlers[K]> extends (...args: any[]) => any
    ? K
    : never;
}[keyof ExtensionHandlers];

// ⭐ 核心：执行某个扩展点（所有实现该扩展点的插件依次跑一遍）
export async function fireExtensionPoint<K extends FnExtensionKeys>(
  point: K,
  ...args: Parameters<NonNullable<ExtensionHandlers[K]>>
): Promise<ReturnType<NonNullable<ExtensionHandlers[K]>>[]> {
  if (!g.__rnPlugins) await bootPlugins();

  const results: unknown[] = [];
  for (const plugin of g.__rnPlugins || []) {
    const handler = plugin.handlers[point] as unknown;
    if (typeof handler === 'function') {
      try {
        const result = await (handler as (...a: unknown[]) => unknown)(...args);
        if (result !== undefined) results.push(result);
      } catch (err) {
        console.error(`[Plugin] ${plugin.slug} ${String(point)} failed:`, err);
      }
    }
  }
  return results as ReturnType<NonNullable<ExtensionHandlers[K]>>[];
}

// 收集某个扩展点的第一个有效返回值（覆盖类扩展点）
export async function firstWins<K extends FnExtensionKeys>(
  point: K,
  ...args: Parameters<NonNullable<ExtensionHandlers[K]>>
): Promise<ReturnType<NonNullable<ExtensionHandlers[K]>> | null> {
  const results = await fireExtensionPoint(point, ...args);
  return (results[0] ?? null) as ReturnType<NonNullable<ExtensionHandlers[K]>> | null;
}

// 对象型扩展点：搜索提供者（第一个启用 searchProvider 的插件生效）
export async function getPluginSearchProvider(): Promise<import('./types').SearchProvider | null> {
  if (!g.__rnPlugins) await bootPlugins();
  for (const plugin of g.__rnPlugins || []) {
    if (plugin.handlers.searchProvider) return plugin.handlers.searchProvider;
  }
  return null;
}

// 对象型扩展点：侧栏 widget（收集所有插件，按 order 排序）
export async function getPluginSidebarWidgets(): Promise<import('./types').SidebarWidgetDef[]> {
  if (!g.__rnPlugins) await bootPlugins();
  const widgets: import('./types').SidebarWidgetDef[] = [];
  for (const plugin of g.__rnPlugins || []) {
    if (typeof plugin.handlers.injectSidebarWidget !== 'function') continue;
    try {
      widgets.push(...plugin.handlers.injectSidebarWidget());
    } catch (err) {
      console.error(`[Plugin] ${plugin.slug} injectSidebarWidget failed:`, err);
    }
  }
  return widgets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// 对象型扩展点：插件自定义前台路由（customFrontendRoutes）
export async function getPluginFrontendRoutes(): Promise<
  (import('./types').FrontendRouteDef & { pluginSlug: string })[]
> {
  if (!g.__rnPlugins) await bootPlugins();
  const routes: (import('./types').FrontendRouteDef & { pluginSlug: string })[] = [];
  for (const plugin of g.__rnPlugins || []) {
    if (!plugin.handlers.customFrontendRoutes?.length) continue;
    for (const route of plugin.handlers.customFrontendRoutes) {
      routes.push({ ...route, pluginSlug: plugin.slug });
    }
  }
  return routes;
}

// 获取已加载插件列表（只读）
export function getLoadedPlugins(): LoadedPlugin[] {
  return g.__rnPlugins || [];
}
