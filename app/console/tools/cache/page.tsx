'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Database,
  EyeOff,
  Globe,
  Loader2,
  Palette,
  RefreshCw,
  Search,
  Wrench,
} from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';

type CacheType = 'site' | 'theme' | 'all';
type MaintAction = 'views' | 'fts' | 'revalidate' | 'all';

const CACHE_CARDS: { type: CacheType; title: string; desc: string; icon: typeof Globe }[] = [
  { type: 'site', title: '站点设置缓存', desc: '清理站点标题 描述与导航等设置项缓存 修改后未生效时使用', icon: Globe },
  { type: 'theme', title: '主题缓存', desc: '清理主题配置与渲染样式缓存 切换主题或改配置后使用', icon: Palette },
  { type: 'all', title: '全部缓存', desc: '一次性清理站点设置与主题缓存 让整站回到最新状态', icon: RefreshCw },
];

const MAINT_CARDS: { action: MaintAction; title: string; desc: string; icon: typeof Globe }[] = [
  { action: 'views', title: '重置浏览量', desc: '把所有文章的浏览量字段归零 适合上线前清理测试数据', icon: EyeOff },
  { action: 'fts', title: '重建搜索索引', desc: '删除并重建 SQLite FTS5 全文索引 搜索异常或文章批量导入后使用', icon: Search },
  { action: 'revalidate', title: '刷新页面缓存', desc: '主动刷新整站 ISR 缓存 让前台立即使用最新数据', icon: RefreshCw },
  { action: 'all', title: '全部执行', desc: '依次重置浏览量 重建索引 刷新页面缓存', icon: Wrench },
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
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  async function run(key: string, payload: Record<string, string>, successText: string) {
    if (busy) return;
    setBusy(key);
    try {
      const res = await fetch('/api/console/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = `请求失败 (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = String(data.error);
        } catch { /* 非 JSON 错误体 */ }
        throw new Error(message);
      }
      toast(successText);
      setDone((d) => ({ ...d, [key]: true }));
      window.setTimeout(() => setDone((d) => ({ ...d, [key]: false })), 2000);
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败 请稍后重试', 'error');
    }
    setBusy(null);
  }

  return (
    <div className="space-y-8">
      {/* 缓存卡片 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4 text-primary" />
          缓存清理
        </h2>
        <div className="grid gap-4 md:grid-cols-3 stagger">
          {CACHE_CARDS.map(({ type, title, desc, icon: Icon }) => {
            const key = `cache:${type}`;
            const isBusy = busy === key;
            const isDone = Boolean(done[key]);
            return (
              <div
                key={type}
                className="flex flex-col rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-300 ${isDone ? 'bg-emerald-50 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" strokeWidth={1.5} />}
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-fg-muted">{desc}</p>
                <button
                  type="button"
                  onClick={() => run(key, { type }, '缓存已清理')}
                  disabled={busy !== null}
                  className={`mt-4 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : 'border border-line text-fg hover:border-primary hover:text-primary'
                  }`}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                  {isBusy ? '清理中' : isDone ? '已清理' : '清理缓存'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 数据维护 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="h-4 w-4 text-primary" />
          数据维护
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger">
          {MAINT_CARDS.map(({ action, title, desc, icon: Icon }) => {
            const key = `maint:${action}`;
            const isBusy = busy === key;
            const isDone = Boolean(done[key]);
            return (
              <div
                key={action}
                className="flex flex-col rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-300 ${isDone ? 'bg-emerald-50 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" strokeWidth={1.5} />}
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-fg-muted">{desc}</p>
                <button
                  type="button"
                  onClick={() => run(key, { action }, '维护操作已完成')}
                  disabled={busy !== null}
                  className={`mt-4 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : 'border border-line text-fg hover:border-primary hover:text-primary'
                  }`}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  {isBusy ? '执行中' : isDone ? '已完成' : '执行'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 说明 */}
      <p className="text-xs leading-relaxed text-fg-muted anim-fade-in" style={{ animationDelay: '0.2s' }}>
        缓存用于加速前台渲染 若修改了站点设置或主题配置但前台未更新 清理对应缓存即可 站点使用 CDN 时还需留意 CDN 自身的缓存策略
        重置浏览量会直接修改文章数据 重建搜索索引期间搜索可能短暂不可用 请在访问低峰期执行
      </p>
    </div>
  );
}
