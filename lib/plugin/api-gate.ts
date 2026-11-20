// lib/plugin/api-gate.ts — 在核心 API 路由前置执行插件 apiMiddleware
// 用法：const blocked = await pluginApiGate(req); if (blocked) return blocked;
import type { NextRequest } from 'next/server';

export async function pluginApiGate(req: NextRequest): Promise<Response | null> {
  try {
    const { runApiMiddlewares } = await import('./engine');
    return await runApiMiddlewares(req);
  } catch (err) {
    console.error('[plugin/api-gate] middleware failed:', err);
    return null;
  }
}
