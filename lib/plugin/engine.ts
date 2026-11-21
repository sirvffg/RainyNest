// lib/plugin/engine.ts — 插件加载与扩展点执行引擎
// 扫描 scripts/plugins（安装态扩展：plugin.json + 已 bundle 的 index.js）→ 加载 → 按扩展点分组 → 执行
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../prisma';
import { analytics } from '../analytics';
import { getSiteSetting } from '../site';
import { getPluginDb } from '../plugin-db';
import { ensurePluginConfigFile, getPluginConfigStore, getPluginJsonStore } from './json-store';
import { importPluginPermissions, importRoleTemplates } from './role-templates';
import { getCoreVersion, satisfiesCoreVersion } from './semver';
import type {
  ExtensionHandlers,
  LoadedPlugin,
  PluginContext,
  PluginLogger,
} from './types';

// 安装目录（内置预装与后台上传共用）：plugin.json 与 index.js 同目录
const PLUGINS_DIR = path.join(process.cwd(), 'scripts', 'plugins');

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

// 事件总线（进程内）：插件通过 ctx.events.on/once/off 订阅，宿主与插件通过 emitEvent 发布
// 每条监听记录来源插件 slug，插件卸载/重载时自动清理其全部监听
interface EventListenerEntry {
  name: string;
  fn: (data: unknown) => void;
  once: boolean;
  pluginSlug: string | null;
}
const eventListeners: EventListenerEntry[] = [];

function removeEventListenerEntry(entry: EventListenerEntry) {
  const i = eventListeners.indexOf(entry);
  if (i >= 0) eventListeners.splice(i, 1);
}

function removePluginEventListeners(pluginSlug: string) {
  for (let i = eventListeners.length - 1; i >= 0; i--) {
    if (eventListeners[i].pluginSlug === pluginSlug) eventListeners.splice(i, 1);
  }
}

function emitEvent(name: string, data: unknown) {
  // 快照遍历：handler 内的 on/off 不影响本轮派发
  for (const entry of [...eventListeners]) {
    if (entry.name !== name) continue;
    if (entry.once) removeEventListenerEntry(entry);
    try {
      const out = entry.fn(data) as unknown;
      // 异步 handler：拒绝只记日志，不影响其他监听
      if (out instanceof Promise) {
        out.catch((err) => console.error(`[Plugin:events] async handler failed for "${name}":`, err));
      }
    } catch (err) {
      console.error(`[Plugin:events] handler failed for "${name}":`, err);
    }
  }
}

// 为单个插件生成事件订阅 API（off/清理都限定在该插件名下）
function createPluginEventApi(pluginSlug: string): import('./types').PluginContext['events'] {
  const subscribe = (name: string, fn: (data: unknown) => void, once: boolean) => {
    const entry: EventListenerEntry = { name, fn, once, pluginSlug };
    eventListeners.push(entry);
    return () => removeEventListenerEntry(entry);
  };
  return {
    on: (name, fn) => subscribe(name, fn, false),
    once: (name, fn) => subscribe(name, fn, true),
    off: (name, fn) => {
      for (let i = eventListeners.length - 1; i >= 0; i--) {
        const e = eventListeners[i];
        if (e.name === name && e.pluginSlug === pluginSlug && (!fn || e.fn === fn)) {
          eventListeners.splice(i, 1);
        }
      }
    },
  };
}

// 懒加载插件库：只有插件真正访问 ctx.pluginDb 时才打开 SQLite 文件
// （避免给不用数据库的插件创建一堆空的 .db 占位文件）
function lazyPluginDb(slug: string): unknown {
  let real: ReturnType<typeof getPluginDb> | null = null;
  return new Proxy({}, {
    get(_target, prop) {
      if (!real) real = getPluginDb(slug);
      const value = Reflect.get(real as object, prop);
      return typeof value === 'function' ? value.bind(real) : value;
    },
  });
}

// 扫描 + 加载所有插件
// 状态机：idle（__rnPlugins 为 null）→ loading（__rnPluginBooting）→ loaded（__rnPlugins 已就绪）
// 已加载后重复调用直接返回（幂等）；resetPluginCache / reloadPlugin 回到 idle 触发重新扫描
export async function bootPlugins(): Promise<void> {
  if (g.__rnPlugins) return;                      // loaded：已完成初始化，不重复扫描
  if (g.__rnPluginBooting) return g.__rnPluginBooting; // loading：并发调用等待同一个 Promise
  const booting = (async () => {
    const plugins: LoadedPlugin[] = [];

    if (fs.existsSync(PLUGINS_DIR)) {
      const dirs = fs.readdirSync(PLUGINS_DIR).filter((d) => {
        // 跳过安装器备份/待删目录
        if (/(\.bak-\d+|\.deleted-\d+)$/.test(d)) return false;
        return fs.statSync(path.join(PLUGINS_DIR, d)).isDirectory();
      });

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

        // 核心版本兼容性：manifest 的 requiresCore 不满足时跳过该插件
        if (meta.requiresCore) {
          const coreVersion = getCoreVersion();
          if (!satisfiesCoreVersion(coreVersion, meta.requiresCore)) {
            console.warn(
              `[Plugin] ${meta.name || dir}(${dir}) 已跳过：要求核心版本 ${meta.requiresCore}，当前核心版本 ${coreVersion}`
            );
            continue;
          }
        }

        try {
          const entryFile = (meta.entry || 'index.ts').replace(/\.tsx?$/, '.js');
          const entryPath = path.join(PLUGINS_DIR, dir, entryFile);
          if (!fs.existsSync(entryPath)) {
            console.error(`[Plugin] ${dir}: 入口产物不存在（${entryFile}），请用 @rainynest/ext 重新安装`);
            continue;
          }

          const mod = nodeRequire(entryPath);
          // 配置数据：db/plugins-json/<slug>.config.json（首次启动用包内默认 config.json 初始化）
          const pluginDir = path.join(PLUGINS_DIR, dir);
          await ensurePluginConfigFile(dir, pluginDir);
          const pluginConfig = await getPluginConfigStore(dir).get();
          const ctx = {
            // 宿主生成客户端/站点设置与 SPI 结构化类型对齐（经 unknown 转换）
            db: db as unknown as PluginContext['db'],
            analytics: analytics as unknown as PluginContext['analytics'],
            pluginDb: lazyPluginDb(dir) as unknown as PluginContext['pluginDb'],
            pluginJson: getPluginJsonStore(dir),
            slug: dir,
            version: meta.version,
            config: pluginConfig,
            site: (await getSiteSetting()) as unknown as PluginContext['site'],
            env: process.env,
            logger: createPluginLogger(dir),
            emitEvent,
            events: createPluginEventApi(dir),
          } as unknown as PluginContext;

          const handlers: ExtensionHandlers =
            typeof mod.default === 'function' ? mod.default(ctx) : {};

          plugins.push({ slug: dir, meta, handlers, enabled: true, config: ctx.config });
        } catch (err) {
          console.error(`[Plugin] Failed to load ${dir}:`, err);
        }
      }
    }

    g.__rnPlugins = plugins;

    // 导入插件声明的权限点与角色模板（失败只记日志，不影响插件加载）
    try {
      await importPluginPermissions(plugins);
    } catch (err) {
      console.error('[Plugin] permissions 导入失败:', err);
    }
    try {
      await importRoleTemplates(plugins);
    } catch (err) {
      console.error('[Plugin] roleTemplates 导入失败:', err);
    }

    // 执行 onMount
    for (const p of plugins) {
      if (p.handlers.onMount) {
        try {
          const mountCtx = {
            db: db as unknown as PluginContext['db'],
            analytics: analytics as unknown as PluginContext['analytics'],
            pluginDb: lazyPluginDb(p.slug) as unknown as PluginContext['pluginDb'],
            pluginJson: getPluginJsonStore(p.slug),
            site: (await getSiteSetting()) as unknown as PluginContext['site'],
            slug: p.slug,
            version: p.meta.version,
            config: p.config,
            env: process.env,
            logger: createPluginLogger(p.slug),
            emitEvent,
            events: createPluginEventApi(p.slug),
          } as unknown as PluginContext;
          await p.handlers.onMount(mountCtx);
        } catch (err) {
          console.error(`[Plugin] ${p.slug} onMount failed:`, err);
        }
      }
    }

      if (plugins.length > 0) {
        console.log(`[Plugin] ✓ Loaded ${plugins.length} plugin(s): ${plugins.map((p) => p.slug).join(', ')}`);
      }
  })();

  // finally 只清 loading 标记；loaded 状态由 g.__rnPlugins 是否就绪决定（加载失败保持 idle 可重试）
  g.__rnPluginBooting = booting;
  return booting.finally(() => {
    g.__rnPluginBooting = null;
  });
}

// 开发模式热重载：重置扩展注册表（回到 idle，下次访问扩展点时重新扫描）
export function resetPluginCache() {
  g.__rnPlugins = null;
}

// 单插件热重载：清除该插件 require 缓存 + 清理其事件监听 + 重置注册表
// 注意：这是「重新扫描全部插件」的单插件入口；宿主整体重载用 reloadAllPlugins()
export function reloadPlugin(slug: string) {
  const dir = path.join(PLUGINS_DIR, slug);
  for (const key of Object.keys(nodeRequire.cache)) {
    if (key === dir || key.startsWith(dir + path.sep)) delete nodeRequire.cache[key];
  }
  removePluginEventListeners(slug);
  resetPluginCache();
}

// 全量重载：清理所有事件监听 + 重置注册表（重新扫描全部插件）
export function reloadAllPlugins() {
  eventListeners.length = 0;
  resetPluginCache();
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

// ═══════════════ 新增 SPI 收集器 ═══════════════

export type ResolvedApiMiddleware = import('./types').ApiMiddlewareDef & {
  pluginSlug: string;
};

// 收集所有插件的 API 过滤器
export async function getApiMiddlewares(): Promise<ResolvedApiMiddleware[]> {
  if (!g.__rnPlugins) await bootPlugins();
  const list: ResolvedApiMiddleware[] = [];
  for (const plugin of g.__rnPlugins || []) {
    for (const def of plugin.handlers.apiMiddleware ?? []) {
      list.push({ ...def, pluginSlug: plugin.slug });
    }
  }
  return list;
}

// 执行 API 过滤器链；返回 Response 表示拦截，返回 null 表示放行
// 失败语义：普通中间件抛错/超时 → 记录日志继续链；critical 中间件失败 → 503 默认拒绝
export async function runApiMiddlewares(req: Request): Promise<Response | null> {
  let middlewares: ResolvedApiMiddleware[] = [];
  try {
    middlewares = await getApiMiddlewares();
  } catch (err) {
    // 引擎级失败（插件加载异常）：无法判断是否存在 critical 中间件，记录日志后放行
    console.error('[Plugin] apiMiddlewares 加载失败，跳过中间件链:', err);
    return null;
  }
  if (middlewares.length === 0) return null;

  const url = new URL(req.url);
  const matched = middlewares.filter((m) => {
    if (m.path && !url.pathname.startsWith(m.path)) return false;
    if (m.methods?.length && !m.methods.includes(req.method as never)) return false;
    return true;
  });
  if (matched.length === 0) return null;

  const criticalFailed = (): Response =>
    new Response(JSON.stringify({ error: '插件安全策略中间件执行失败，请求被拒绝' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });

  let index = 0;
  const next = async (): Promise<Response> => {
    if (index >= matched.length) return new Response(null, { status: 204 });
    const mw = matched[index++];

    // 严格单次 next()：重复调用抛错；handler 调用了 next() 但丢弃返回值时复用链上结果
    let nextCalled = false;
    let chainResult: Promise<Response> | null = null;
    const nextOnce = async (): Promise<Response> => {
      if (nextCalled) throw new Error(`[Plugin] ${mw.pluginSlug} apiMiddleware 多次调用 next()`);
      nextCalled = true;
      chainResult = next();
      return chainResult;
    };

    // 超时保护：def.timeout 可覆盖，默认 10s
    const timeoutMs = mw.timeout ?? 10_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`[Plugin] ${mw.pluginSlug} apiMiddleware 超时(${timeoutMs}ms)`)), timeoutMs);
    });

    try {
      const out = await Promise.race([
        Promise.resolve(mw.handler(req, nextOnce)),
        timeoutPromise,
      ]);
      if (out instanceof Response) return out;
      if (chainResult) return await chainResult; // handler 调了 next() 但返回 void
      return await nextOnce();                    // handler 什么都没做 → 继续链
    } catch (err) {
      console.error(`[Plugin] ${mw.pluginSlug} apiMiddleware${mw.critical ? '(critical)' : ''} failed:`, err);
      if (mw.critical) return criticalFailed();   // 安全策略中间件：默认拒绝
      if (chainResult) return await chainResult;  // 普通中间件：继续已启动的链
      return await nextOnce();
    } finally {
      clearTimeout(timer);
    }
  };

  const result = await next();
  // 204 是链尾占位，视为放行
  return result.status === 204 ? null : result;
}

// 附件存储提供者（第一个提供的插件生效）
export async function getAttachmentStorageProvider(): Promise<
  (import('./types').AttachmentStorageProvider & { pluginSlug: string }) | null
> {
  if (!g.__rnPlugins) await bootPlugins();
  for (const plugin of g.__rnPlugins || []) {
    if (plugin.handlers.attachmentStorage) {
      return { ...plugin.handlers.attachmentStorage, pluginSlug: plugin.slug };
    }
  }
  return null;
}

// 通知器提供者（第一个提供的插件生效；未提供则回退内置 SMTP）
export async function getPluginNotifier(): Promise<
  (import('./types').PluginNotifier & { pluginSlug: string }) | null
> {
  if (!g.__rnPlugins) await bootPlugins();
  for (const plugin of g.__rnPlugins || []) {
    if (plugin.handlers.notifier) {
      return { ...plugin.handlers.notifier, pluginSlug: plugin.slug };
    }
  }
  return null;
}

// 插件声明的可覆盖模板清单
export async function getProvidedTemplates(): Promise<
  { pluginSlug: string; name: string }[]
> {
  if (!g.__rnPlugins) await bootPlugins();
  const list: { pluginSlug: string; name: string }[] = [];
  for (const plugin of g.__rnPlugins || []) {
    for (const name of plugin.handlers.providesTemplates ?? []) {
      list.push({ pluginSlug: plugin.slug, name });
    }
  }
  return list;
}

// 通用数组型扩展点收集（带插件 slug）
export interface ResolvedDefinition {
  pluginSlug: string;
  pluginName: string;
  // 扩展点元素类型各不相同，调用方按具体扩展点断言
  def: any;
}

export async function collectPluginDefinitions(point: keyof ExtensionHandlers): Promise<ResolvedDefinition[]> {
  if (!g.__rnPlugins) await bootPlugins();
  const out: ResolvedDefinition[] = [];
  for (const plugin of g.__rnPlugins || []) {
    const value = (plugin.handlers as Record<string, unknown>)[point as string];
    if (value === null || value === undefined) continue;

    // 扩展点有两种形态：直接数组（声明式）或函数返回数组（函数型 SPI，如 injectHeaderAction / editorCreate）
    let resolved: unknown = value;
    if (typeof value === 'function') {
      try {
        resolved = await (value as () => unknown)();
      } catch (err) {
        // 单个插件函数抛错只跳过该插件，不影响其他插件
        console.error(`[Plugin] ${plugin.slug} ${String(point)} failed:`, err);
        continue;
      }
    }
    if (resolved === null || resolved === undefined) continue;

    const items = Array.isArray(resolved) ? resolved : [resolved];
    for (const def of items) {
      out.push({ pluginSlug: plugin.slug, pluginName: plugin.meta.name, def });
    }
  }
  return out;
}
