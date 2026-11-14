// components/admin/utils.ts — 后台公共工具（slug 生成 / 时间格式化 / API 调用）

/** 生成 URL 别名：小写 空格转连字符 保留字母数字与中日韩字符 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u00c0-\uffff-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 格式化为 YYYY-MM-DD HH:mm */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '-';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 相对时间（超过 30 天回退到绝对时间） */
export function timeAgo(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return formatDate(d);
}

/** 兼容 { list } 与纯数组两种响应 */
export function pickList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { list?: unknown }).list)) {
    return (data as { list: T[] }).list;
  }
  return [];
}

/**
 * 统一 fetch：JSON 请求 + 非 2xx 抛错（自动读取 message/error 字段）
 * 内置防重复提交：同 method+url+body 的写请求在飞行中合并为同一个 Promise，
 * 双击/连按/Enter 重复提交只会发出一次网络请求（GET 不合并，保证刷新语义）
 */
const inflight = new Map<string, Promise<unknown>>();

export function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const bodyKey = method === 'GET' ? '' : ` ${(typeof init?.body === 'string' ? init.body : '')}`;
  const key = `${method} ${url}${bodyKey}`;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const req = (async () => {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      let msg = `请求失败 (${res.status})`;
      try {
        const data = await res.json();
        if (data && (data.message || data.error)) msg = String(data.message || data.error);
      } catch {
        /* 非 JSON 错误体 */
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  })();

  inflight.set(key, req);
  return req.finally(() => inflight.delete(key)) as Promise<T>;
}
