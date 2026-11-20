// lib/analytics/geo.ts — 访客国家/地区解析
// 优先使用 CDN / 反向代理注入的请求头；没有时尝试可选的 geoip-lite（未安装则返回 null）

// 从请求头解析国家码（ISO 3166-1 alpha-2，大写）
export function countryFromHeaders(headers: Headers): string | null {
  const raw =
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('x-country-code');
  const code = raw?.trim().toUpperCase();
  if (!code || code.length !== 2 || code === 'XX' || code === 'T1') return null;
  return code;
}

// 内网 / 回环 IP 不查询 GeoIP
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
  return false;
}

// 解析国家码：请求头优先，其次 geoip-lite（可选依赖，动态加载不参与打包）
export async function resolveCountry(ip: string, headers: Headers): Promise<string | null> {
  const fromHeader = countryFromHeaders(headers);
  if (fromHeader) return fromHeader;
  if (isPrivateIp(ip)) return null;

  try {
    // 使用非字面量模块名，避免构建期强制解析可选依赖
    const moduleName: string = 'geoip-lite';
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleName)) as {
      lookup?: (ip: string) => { country?: string } | null;
      default?: { lookup?: (ip: string) => { country?: string } | null };
    };
    const lookup = mod.lookup ?? mod.default?.lookup;
    const hit = lookup?.(ip);
    const code = hit?.country?.toUpperCase();
    return code && code.length === 2 ? code : null;
  } catch {
    // geoip-lite 未安装或查询失败：静默降级
    return null;
  }
}
