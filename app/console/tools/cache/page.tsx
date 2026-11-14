'use client';

import { useState } from 'react';
import { CheckCircle2, Globe, Loader2, Palette, RefreshCw } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';

type CacheType = 'site' | 'theme' | 'all';

const CARDS: { type: CacheType; title: string; desc: string; icon: typeof Globe }[] = [
  { type: 'site', title: '站点设置缓存', desc: '清理站点标题 描述与导航等设置项缓存 修改后未生效时使用', icon: Globe },
  { type: 'theme', title: '主题缓存', desc: '清理主题配置与渲染样式缓存 切换主题或改配置后使用', icon: Palette },
  { type: 'all', title: '全部缓存', desc: '一次性清理站点设置与主题缓存 让整站回到最新状态', icon: RefreshCw },
];

export default function CachePage() {
  return (
    <ToastProvider>
      <CacheContent />
    </ToastProvider>
  );
}

function CacheContent() {
  const toast = useToast();
  const [cleaning, setCleaning] = useState<CacheType | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  async function clearCache(type: CacheType) {
    if (cleaning) return;
    setCleaning(type);
    try {
      const res = await fetch('/api/console/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast('缓存已清理');
      setDone((d) => ({ ...d, [type]: true }));
      window.setTimeout(() => setDone((d) => ({ ...d, [type]: false })), 2000);
    } catch {
      toast('清理失败 请稍后重试', 'error');
    }
    setCleaning(null);
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="anim-fade-in-up">
        <h1 className="text-2xl font-bold">缓存管理</h1>
        <p className="mt-1 text-sm text-fg-muted">改动未生效 先清缓存再看看</p>
      </div>

      {/* 缓存卡片 */}
      <div className="grid gap-4 md:grid-cols-3 stagger">
        {CARDS.map(({ type, title, desc, icon: Icon }) => {
          const isCleaning = cleaning === type;
          const isDone = Boolean(done[type]);
          return (
            <div
              key={type}
              className="flex flex-col rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-300 ${isDone ? 'bg-emerald-50 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" strokeWidth={1.5} />}
              </span>
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-fg-muted">{desc}</p>
              <button
                type="button"
                onClick={() => clearCache(type)}
                disabled={cleaning !== null}
                className={`mt-4 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : 'border border-line text-fg hover:border-primary hover:text-primary'
                }`}
              >
                {isCleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {isCleaning ? '清理中' : isDone ? '已清理' : '清理缓存'}
              </button>
            </div>
          );
        })}
      </div>

      {/* 说明 */}
      <p className="text-xs leading-relaxed text-fg-muted anim-fade-in" style={{ animationDelay: '0.2s' }}>
        缓存用于加速前台渲染 若修改了站点设置或主题配置但前台未更新 清理对应缓存即可 站点使用 CDN 时还需留意 CDN 自身的缓存策略
      </p>
    </div>
  );
}
