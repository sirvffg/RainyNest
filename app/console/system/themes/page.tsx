'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Palette, Settings2, Trash2, Upload, Users } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Modal from '@/components/admin/Modal';
import ConfigForm, { buildDefaultConfig, type ConfigSchema } from '@/components/admin/ConfigForm';

interface ThemeItem {
  id: string;
  slug: string;
  name: string;
  version: string;
  description?: string | null;
  author?: string | null;
  preview?: string | null;
  isActive: boolean;
  source?: 'builtin' | 'uploaded' | string;
  configSchema?: ConfigSchema | null;
  config?: Record<string, unknown> | null;
}

export default function ThemesPage() {
  return (
    <ToastProvider>
      <ThemesContent />
    </ToastProvider>
  );
}

function ThemesContent() {
  const toast = useToast();
  const [list, setList] = useState<ThemeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState<ThemeItem | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<ThemeItem | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/console/themes');
      const data = await res.json();
      setList(data.list ?? []);
    } catch {
      toast('加载主题列表失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function activate(theme: ThemeItem) {
    if (activating) return;
    setActivating(theme.slug);
    try {
      const res = await fetch(`/api/console/themes/${encodeURIComponent(theme.slug)}/activate`, { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      toast(`主题「${theme.name}」已启用`);
      load();
    } catch {
      toast('启用失败 请稍后重试', 'error');
    }
    setActivating(null);
  }

  // 上传安装主题包（*.gz.rainy-theme / *.zip.rainy-theme）
  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/console/themes/install', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '安装失败');
      toast(`主题「${data.slug}」${data.upgraded ? '升级' : '安装'}成功`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '安装失败 请稍后重试', 'error');
    }
    setUploading(false);
  }

  // 卸载上传主题（使用中需先切换其他主题）
  async function doUninstall() {
    if (!uninstallTarget || uninstalling) return;
    setUninstalling(true);
    try {
      const res = await fetch(`/api/console/themes/${encodeURIComponent(uninstallTarget.slug)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '卸载失败');
      toast(`主题「${uninstallTarget.name}」已卸载`);
      setUninstallTarget(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '卸载失败 请稍后重试', 'error');
    }
    setUninstalling(false);
  }

  function openConfig(theme: ThemeItem) {
    setConfigTarget(theme);
    setConfig(buildDefaultConfig(theme.configSchema ?? {}, theme.config));
  }

  async function saveConfig() {
    if (savingConfig || !configTarget) return;
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/console/themes/${encodeURIComponent(configTarget.slug)}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast('主题配置已保存');
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
      <div className="anim-fade-in-up flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">主题管理</h1>
          <p className="mt-1 text-sm text-fg-muted">切换站点外观 微调主题配置</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".gz.rainy-theme,.zip.rainy-theme"
            className="hidden"
            onChange={onUploadFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? '上传中' : '上传安装'}
          </button>
        </div>
      </div>

      {/* 主题网格 */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-line bg-bg p-3">
              <div className="skeleton aspect-video w-full" />
              <div className="skeleton mt-3 h-4 w-2/3" />
              <div className="skeleton mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="anim-fade-in rounded-lg border border-dashed border-line px-6 py-16 text-center text-fg-muted">
          <Palette className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm">暂无已安装主题</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {list.map((theme) => (
            <div
              key={theme.id}
              className={`overflow-hidden rounded-lg border bg-bg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                theme.isActive ? 'border-primary/60 ring-1 ring-primary/20' : 'border-line'
              }`}
            >
              {/* 预览图 */}
              <div className="relative aspect-video overflow-hidden bg-bg-secondary">
                {theme.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={theme.preview}
                    alt={theme.name}
                    className="h-full w-full object-cover transition-transform duration-500 ease-smooth hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Palette className="h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
                  </div>
                )}
                {theme.isActive && (
                  <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white shadow anim-scale-in">
                    <Check className="h-3 w-3" />
                    使用中
                  </span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{theme.name}</h3>
                  <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-fg-muted">v{theme.version}</span>
                  {theme.source === 'builtin' && (
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">内置</span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-fg-muted">
                  <Users className="h-3 w-3" />
                  {theme.author || '未知作者'}
                </p>
                <p className="mt-1.5 line-clamp-2 min-h-[2.4em] text-xs leading-relaxed text-fg-muted">{theme.description || '暂无描述'}</p>
                <div className="mt-3 flex items-center gap-2">
                  {!theme.isActive && (
                    <button
                      type="button"
                      onClick={() => activate(theme)}
                      disabled={activating !== null}
                      className="liquid-btn liquid-btn-sm inline-flex flex-1 items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                    >
                      {activating === theme.slug && <Loader2 className="h-4 w-4 animate-spin" />}
                      {activating === theme.slug ? '启用中' : '启用'}
                    </button>
                  )}
                  {theme.isActive && (
                    <span className="flex flex-1 items-center justify-center rounded border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                      当前主题
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => openConfig(theme)}
                    className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                  >
                    <Settings2 className="h-4 w-4" />
                    配置
                  </button>
                  {theme.source !== 'builtin' && (
                    <button
                      type="button"
                      onClick={() => setUninstallTarget(theme)}
                      className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-red-400 hover:bg-red-50 hover:text-red-500 active:scale-95"
                    >
                      <Trash2 className="h-4 w-4" />
                      卸载
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 配置模态 */}
      <Modal
        open={!!configTarget}
        onClose={() => setConfigTarget(null)}
        title={`配置主题 · ${configTarget?.name ?? ''}`}
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

      {/* 卸载确认模态 */}
      <Modal
        open={!!uninstallTarget}
        onClose={() => !uninstalling && setUninstallTarget(null)}
        title={`卸载主题 · ${uninstallTarget?.name ?? ''}`}
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUninstallTarget(null)}
              disabled={uninstalling}
              className="rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              onClick={doUninstall}
              disabled={uninstalling}
              className="inline-flex items-center gap-1.5 rounded border border-red-300 px-4 py-2 text-sm text-red-500 transition-all duration-200 hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed"
            >
              {uninstalling && <Loader2 className="h-4 w-4 animate-spin" />}
              确认卸载
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-fg-muted">
          卸载后主题文件与配置记录将被删除 站点恢复为默认外观
        </p>
      </Modal>
    </div>
  );
}
