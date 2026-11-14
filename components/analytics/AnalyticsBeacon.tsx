'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// 访问统计上报组件：放在 app/layout.tsx 全站自动挂载
// sendBeacon 异步、不阻塞、页面卸载也不丢数据
export default function AnalyticsBeacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      // 初始化 sessionId（同一浏览器会话内唯一）
      let sessionId = sessionStorage.getItem('rn-sid');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('rn-sid', sessionId);
      }

      const postMatch = pathname.match(/^\/web\/blog\/([^/]+)/);
      const pvData = JSON.stringify({
        path: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''),
        postSlug: postMatch ? postMatch[1] : null,
        sessionId,
        referer: document.referrer || '',
        ua: navigator.userAgent,
        // 客户端拿不到真实 IP，API 层从 x-forwarded-for 取
      });

      navigator.sendBeacon('/api/analytics/pv', new Blob([pvData], { type: 'application/json' }));
    } catch {
      // sendBeacon 不可用时的兜底
      try {
        fetch('/api/analytics/pv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: pathname,
            sessionId: sessionStorage.getItem('rn-sid') || '',
            referer: document.referrer || '',
            ua: navigator.userAgent,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* 静默忽略 */ }
    }
  }, [pathname, searchParams]);

  return null; // 纯副作用组件
}
