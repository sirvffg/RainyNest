// app/api/analytics/pv/route.ts — PV 上报入口（立即响应，不碰 SQLite）
import { enqueuePageView } from '@/lib/analytics/queue';
import { resolveCountry } from '@/lib/analytics/geo';
import { fireExtensionPoint } from '@/lib/plugin/engine';
import { getSiteSetting } from '@/lib/site';

export const runtime = 'nodejs'; // 必须 Node Runtime（进程内队列需要常驻）

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // 简易防滥用：path 必填，长度限制
    if (!data?.path || typeof data.path !== 'string' || data.path.length > 500) {
      return Response.json({ ok: false }, { status: 400 });
    }

    // 按「系统设置 → 访客 IP 获取方式」决定从哪个头取 IP（后台可配，避免代码硬判断）
    const site = await getSiteSetting();
    const mode = site.ipSource || 'auto';
    const header = (name: string) => req.headers.get(name);
    const ip = (() => {
      switch (mode) {
        case 'x-forwarded-for':
          return header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        case 'x-real-ip':
          return header('x-real-ip') || '127.0.0.1';
        case 'cf-connecting-ip':
          return header('cf-connecting-ip') || '127.0.0.1';
        case 'custom': {
          // 自定义代理头（后台「自定义头名称」指定，大小写不敏感）
          const custom = site.ipCustomHeader?.trim();
          if (!custom) return '127.0.0.1';
          const v = header(custom) ?? header(custom.toLowerCase());
          return v?.split(',')[0].trim() || '127.0.0.1';
        }
        case 'direct':
          return '127.0.0.1'; // 不读任何头（直连部署）
        default: // auto：按代理优先级自动判断
          return (
            header('cf-connecting-ip') ||
            header('x-client-ip') ||
            header('x-forwarded-for')?.split(',')[0].trim() ||
            header('x-real-ip') ||
            '127.0.0.1'
          );
      }
    })();

    const path = data.path as string;
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';

    // 国家/地区：请求头优先，其次可选的 geoip-lite；失败时静默降级为 null
    let country: string | null = null;
    try {
      country = await resolveCountry(ip, req.headers);
    } catch { /* 解析失败不影响上报 */ }

    // 入队 → 立即返回（不 await 任何 DB 操作，响应 < 5ms）
    enqueuePageView({
      path,
      postSlug: typeof data.postSlug === 'string' ? data.postSlug : null,
      sessionId,
      ip,
      country,
      userAgent: req.headers.get('user-agent') || data.ua || '',
      referer: typeof data.referer === 'string' ? data.referer : '',
      createdAt: new Date(),
    });

    // 插件扩展点：onPageView（异步执行，不阻塞响应、不中断上报）
    void fireExtensionPoint('onPageView', { path, ip, sessionId }).catch(() => {});

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
