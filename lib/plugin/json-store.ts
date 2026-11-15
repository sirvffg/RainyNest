// lib/plugin/json-store.ts — 插件 JSON 文件存储（db/plugins-json/）
// 每个插件两个文件：
//   <slug>.run.json    运行数据（ctx.pluginJson 读写，如 PV 计数）
//   <slug>.config.json 配置数据（后台设置，安装时从包内默认 config.json 初始化）
// 每次读取都直接读文件（文件小，且天然支持热重载后数据一致）
import fs from 'node:fs/promises';
import path from 'node:path';

const JSON_DIR = path.join(process.cwd(), 'db', 'plugins-json');

function storeFile(slug: string, kind: 'run' | 'config'): string {
  // slug 已在引擎侧经过目录名校验，这里再防一次路径越界
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
    throw new Error(`Invalid plugin slug for json store: ${slug}`);
  }
  return path.join(JSON_DIR, `${slug}.${kind}.json`);
}

// 每个文件一条写入队列：串行化 set/replace，避免并发写交错丢数据
const writeQueues = new Map<string, Promise<void>>();

function enqueueWrite<T>(file: string, task: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(file) || Promise.resolve();
  const next = prev.then(task, task);
  writeQueues.set(file, next.then(() => undefined, () => undefined));
  return next;
}

function createStore(file: string) {
  return {
    async get(): Promise<Record<string, any>> {
      try {
        return JSON.parse(await fs.readFile(file, 'utf-8'));
      } catch {
        return {};
      }
    },

    async set(patch: Record<string, any>): Promise<Record<string, any>> {
      return enqueueWrite(file, async () => {
        let current: Record<string, any> = {};
        try {
          current = JSON.parse(await fs.readFile(file, 'utf-8'));
        } catch { /* 文件不存在或损坏，按空对象处理 */ }
        const next = { ...current, ...patch };
        await fs.mkdir(JSON_DIR, { recursive: true });
        await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf-8');
        return next;
      });
    },

    async replace(data: Record<string, any>): Promise<void> {
      await enqueueWrite(file, async () => {
        await fs.mkdir(JSON_DIR, { recursive: true });
        await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
      });
    },
  };
}

// 运行数据存储（ctx.pluginJson）
export function getPluginJsonStore(slug: string) {
  return createStore(storeFile(slug, 'run'));
}

// 配置数据存储（后台插件设置）
export function getPluginConfigStore(slug: string) {
  return createStore(storeFile(slug, 'config'));
}

// 初始化配置文件：不存在时从插件包内的默认 config.json 复制，包里没有则写 {}
// 引擎启动时调用，内置预装与上传安装统一覆盖；已存在的配置不会被覆盖（升级保留）
export async function ensurePluginConfigFile(slug: string, pluginDir: string): Promise<void> {
  const file = storeFile(slug, 'config');
  try {
    await fs.access(file);
    return; // 已有配置（用户改过或之前装过），不覆盖
  } catch { /* 不存在，继续初始化 */ }

  let defaults: Record<string, any> = {};
  try {
    defaults = JSON.parse(
      await fs.readFile(path.join(pluginDir, 'config.json'), 'utf-8')
    );
  } catch { /* 包内无默认配置 */ }

  await fs.mkdir(JSON_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(defaults, null, 2), 'utf-8');
}

// 卸载插件时删除其 JSON 存储（keepData 时保留）
export function deletePluginJsonFiles(slug: string): void {
  for (const kind of ['run', 'config'] as const) {
    try {
      fs.rm(storeFile(slug, kind), { force: true }).catch(() => {});
    } catch { /* ignore */ }
  }
}
