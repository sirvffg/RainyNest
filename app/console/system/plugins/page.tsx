'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Power, Puzzle, Settings2, Users } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Modal from '@/components/admin/Modal';
import ConfigForm, { buildDefaultConfig, type ConfigSchema } from '@/components/admin/ConfigForm';

interface PluginItem {
  id: string;
  slug: string;
  name: string;
  version: string;
  description?: string | null;
  author?: string | null;
  isActive: boolean;
  configSchema?: ConfigSchema | null;
  config?: Record<string, unknown> | null;
}

export default function PluginsPage() {
  return (
    <ToastProvider>
      <PluginsContent />
    </ToastProvider>
  );
}

// 模块级缓存：跨路由返回时不闪骨架
let cachedList: PluginItem[] | null = null;

function PluginsContent() {
  const toast = useToast();
  // 模块级缓存：二次进入立即渲染上次数据，不再闪骨架
  const [list, setList] = useState<PluginItem[]>(cachedList ?? []);
  const [loading, setLoading] = useState(!cachedList);
  const [toggling, setToggling] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState<PluginItem | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const load = useCallback(async () => {
    // 有缓存时不重置 loading（避免二次进入闪骨架），后台静默刷新
    try {
      const res = await fetch('/api/console/plugins');
      const data = await res.json();
      const next: PluginItem[] = data.list ?? [];
      cachedList = next;
      setList(next);
    } catch {
      toast('加载插件列表失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(plugin: PluginItem) {
    if (toggling) return;
    setToggling(plugin.slug);
    const nextActive = !plugin.isActive;
    try {
      const action = plugin.isActive ? 'deactivate' : 'activate';
      const res = await fetch(`/api/console/plugins/${encodeURIComponent(plugin.slug)}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      toast(nextActive ? `插件「${plugin.name}」已启用` : `插件「${plugin.name}」已停用`);
      // 本地更新状态，不重拉列表 → 无闪动
      setList((prev) => {
        const next = prev.map((p) => (p.slug === plugin.slug ? { ...p, isActive: nextActive } : p));
        cachedList = next;
        return next;
      });
      // 通知侧栏局部刷新插件菜单（不整页刷新）
      window.dispatchEvent(new CustomEvent('rainynest:plugin-nav-changed'));
    } catch {
      toast(nextActive ? '启用失败 请稍后重试' : '停用失败 请稍后重试', 'error');
    }
    setToggling(null);
  }

  function openConfig(plugin: PluginItem) {
    setConfigTarget(plugin);
    setConfig(buildDefaultConfig(plugin.configSchema ?? {}, plugin.config));
  }

  async function saveConfig() {
    if (savingConfig || !configTarget) return;
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/console/plugins/${encodeURIComponent(configTarget.slug)}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast('插件配置已保存');
      setConfigTarget(null);
      load();
    } catch {
      toast('保存失败 请稍后重试', 'error');
    }
    setSavingConfig(false);
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="anim-fade-in-up">
        <h1 className="text-2xl font-bold">插件管理</h1>
        <p className="mt-1 text-sm text-fg-muted">为站点按需扩展能力</p>
      </div>

      {/* 插件网格 */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-44 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="anim-fade-in rounded-lg border border-dashed border-line px-6 py-16 text-center text-fg-muted">
          <Puzzle className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm">暂无已安装插件</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {list.map((plugin) => (
            <div
              key={plugin.id}
              className={`rounded-lg border bg-bg p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                plugin.isActive ? 'border-primary/60 ring-1 ring-primary/20' : 'border-line'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                    plugin.isActive ? 'bg-primary/10 text-primary' : 'bg-bg-secondary text-fg-muted'
                  }`}
                >
                  <Puzzle className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{plugin.name}</h3>
                    <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-fg-muted">v{plugin.version}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
                    <Users className="h-3 w-3" />
                    {plugin.author || '未知作者'}
                  </p>
                </div>
              </div>
              <p className="mt-2.5 line-clamp-2 min-h-[2.4em] text-xs leading-relaxed text-fg-muted">{plugin.description || '暂无描述'}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(plugin)}
                  disabled={toggling !== null}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:cursor-not-allowed ${
                    plugin.isActive
                      ? 'border border-line text-fg-muted hover:border-red-400 hover:bg-red-50 hover:text-red-500'
                      : 'bg-primary text-white hover:bg-primary-hover'
                  } ${toggling === plugin.slug ? 'opacity-60' : ''}`}
                >
                  {toggling === plugin.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  {toggling === plugin.slug ? '处理中' : plugin.isActive ? '停用' : '启用'}
                </button>
                <button
                  type="button"
                  onClick={() => openConfig(plugin)}
                  className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                >
                  <Settings2 className="h-4 w-4" />
                  配置
                </button>
              </div>
              {plugin.isActive && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 anim-fade-in">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  运行中
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 配置模态 */}
      <Modal
        open={!!configTarget}
        onClose={() => setConfigTarget(null)}
        title={`配置插件 · ${configTarget?.name ?? ''}`}
        maxWidth="max-w-xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfigTarget(null)}
              className="rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95"
            >
              取消
            </button>
            <button
              type="button"
              onClick={saveConfig}
              disabled={savingConfig}
              className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
            >
              {savingConfig && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingConfig ? '保存中' : '保存配置'}
            </button>
          </div>
        }
      >
        {configTarget && (
          <ConfigForm
            schema={configTarget.configSchema ?? {}}
            value={config}
            onChange={(key, v) => setConfig((c) => ({ ...c, [key]: v }))}
          />
        )}
      </Modal>
    </div>
  );
}
