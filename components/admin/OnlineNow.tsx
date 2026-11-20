'use client';

// components/admin/OnlineNow.tsx — 仪表盘「实时在线」卡片（EventSource 订阅 SSE）
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

export default function OnlineNow() {
  const [online, setOnline] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    const es = new EventSource('/api/analytics/online');
    es.onopen = () => setConnected(true);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { online?: unknown };
        if (typeof data.online === 'number') setOnline(data.online);
      } catch {
        /* 忽略非 JSON 心跳 */
      }
    };
    // 出错时浏览器会自动重连，这里只更新连接状态
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return (
    <div className="anim-fade-in-up flex items-center gap-4 rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Users className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          实时在线
          <span
            className={`inline-flex items-center gap-1 text-[11px] ${
              connected ? 'text-emerald-500' : 'text-fg-muted'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'
              }`}
            />
            {connected ? '直播中' : '连接中'}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-3xl font-bold tracking-tight">
          {online === null ? '--' : online.toLocaleString('zh-CN')}
          <span className="text-xs font-normal text-fg-muted">最近 5 分钟活跃会话</span>
        </div>
      </div>
    </div>
  );
}
