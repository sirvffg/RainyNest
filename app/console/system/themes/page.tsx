'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Eye, GitBranch, Loader2, Palette, Settings2, Trash2, Upload, Users } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Modal from '@/components/admin/Modal';

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
  missing?: boolean;
  templates?: string[];
  settingsHref?: string | null;
  configSchema?: Record<string, { label?: string; fields?: Record<string, unknown> }> | null;
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
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<ThemeItem | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  // Git 安装
  const [gitOpen, setGitOpen] = useState(false);
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitRef, setGitRef] = useState('');
  const [gitInstalling, setGitInstalling] = useState(false);
  const [themeTabs, setThemeTabs] = useState<{ pluginSlug: string; key: string; label: string; html: string }[]>([]);
  const [themeTab, setThemeTab] = useState('');
  const [themeOps, setThemeOps] = useState<{ label: string; hrefTemplate: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/console/themes');
      const data = await res.json();
      setList(data.list ?? []);
      setThemeTabs(Array.isArray(data.tabs) ? data.tabs : []);
      setThemeOps(Array.isArray(data.operations) ? data.operations : []);
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

  // 预览主题：新窗口打开独立预览路由（不写 cookie，避免全站动态化）
  async function previewTheme(theme: ThemeItem) {
    if (previewing) return;
    setPreviewing(theme.slug);
    try {
      const res = await fetch(`/api/console/themes/preview?slug=${encodeURIComponent(theme.slug)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '预览失败');
      toast(`正在预览「${theme.name}」`);
      window.open(`/preview?theme=${encodeURIComponent(theme.slug)}`, '_blank');
    } catch (err) {
      toast(err instanceof Error ? err.message : '预览失败 请稍后重试', 'error');
    }
    setPreviewing(null);
  }

  // Git 仓库安装主题
  async function installFromGit() {
    if (gitInstalling) return;
    const repoUrl = gitRepoUrl.trim();
    if (!repoUrl) {
      toast('请输入仓库地址', 'error');
      return;
    }
    setGitInstalling(true);
    try {
      const res = await fetch('/api/console/themes/git-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, ref: gitRef.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '安装失败');
      toast(`主题「${data.name || data.slug}」${data.upgraded ? '升级' : '安装'}成功`);
      setGitOpen(false);
      setGitRepoUrl('');
      setGitRef('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Git 安装失败 请稍后重试', 'error');
    }
    setGitInstalling(false);
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="anim-fade-in-up flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGitOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
          >
            <GitBranch className="h-4 w-4" />
            Git 安装
          </button>
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

      {/* 主题扩展面板（themeListTab 注入） */}
      {themeTabs.length > 0 && (
        <div className="anim-fade-in rounded-lg border border-line bg-bg p-4">
          <div className="mb-2 flex flex-wrap gap-1 border-b border-line pb-2">
            {themeTabs.map((t) => (
              <button
                key={`${t.pluginSlug}:${t.key}`}
                type="button"
                onClick={() => setThemeTab(t.key)}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  (themeTab || themeTabs[0]?.key) === t.key ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-bg-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            className="text-sm"
            dangerouslySetInnerHTML={{
              __html: (themeTabs.find((t) => t.key === themeTab) ?? themeTabs[0])?.html ?? '',
            }}
          />
        </div>
      )}

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
              key={theme.slug}
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
                {(theme.templates?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-primary/80">可覆盖 {theme.templates?.length ?? 0} 个插件模板</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!theme.isActive && !theme.missing && (
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
                    onClick={() => previewTheme(theme)}
                    disabled={previewing !== null || !!theme.missing}
                    className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {previewing === theme.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    预览
                  </button>
                  {theme.settingsHref && !theme.missing && (
                    <Link
                      href={theme.settingsHref}
                      className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                    >
                      <Settings2 className="h-4 w-4" />
                      设置
                    </Link>
                  )}
                  {theme.source !== 'builtin' && !theme.missing && (
                    <button
                      type="button"
                      onClick={() => setUninstallTarget(theme)}
                      className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-red-400 hover:bg-red-50 hover:text-red-500 active:scale-95"
                    >
                      <Trash2 className="h-4 w-4" />
                      卸载
                    </button>
                  )}
                  {themeOps.map((op) => (
                    <a
                      key={op.label}
                      href={op.hrefTemplate.replace('{slug}', theme.slug)}
                      className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                    >
                      {op.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Git 安装模态 */}
      <Modal
        open={gitOpen}
        onClose={() => !gitInstalling && setGitOpen(false)}
        title="从 Git 仓库安装主题"
        maxWidth="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGitOpen(false)}
              disabled={gitInstalling}
              className="rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="button"
              onClick={installFromGit}
              disabled={gitInstalling}
              className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
            >
              {gitInstalling && <Loader2 className="h-4 w-4 animate-spin" />}
              {gitInstalling ? '安装中' : '开始安装'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm text-fg-muted">仓库地址</span>
            <input
              type="url"
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              placeholder="https://github.com/user/rainynest-theme"
              className="w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-fg-muted">仅支持 http(s) 仓库；GitHub / Gitee 克隆失败时自动改用归档下载</p>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm text-fg-muted">分支 / 标签（可选）</span>
            <input
              type="text"
              value={gitRef}
              onChange={(e) => setGitRef(e.target.value)}
              placeholder="main"
              className="w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-fg-muted">留空使用仓库默认分支；仓库根目录需包含 theme.json</p>
          </div>
        </div>
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
