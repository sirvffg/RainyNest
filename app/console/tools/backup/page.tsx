'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  Download,
  HardDriveDownload,
  Info,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface BackupMeta {
  name: string;
  createdAt: string;
  type: 'manual' | 'auto';
  size: number;
  files: string[];
}

const TIPS = [
  '备份包含主库 统计库 插件数据库与插件 JSON 数据 存在 db/backups/ 目录下',
  '备份包含密码哈希等敏感信息 请妥善保管 避免外传',
  '建议在更新版本或大改动前先执行一次备份',
  '自动备份规则在「系统设置」中配置 留空即关闭 默认保留最近 7 份',
];

function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function BackupPage() {
  return (
    <ToastProvider>
      <BackupContent />
    </ToastProvider>
  );
}

function BackupContent() {
  const toast = useToast();
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreTip, setRestoreTip] = useState('');
  const [pluginTabs, setPluginTabs] = useState<{ pluginSlug: string; key: string; label: string; html: string }[]>([]);
  const [pluginTab, setPluginTab] = useState('');
  const [pluginOps, setPluginOps] = useState<{ label: string; hrefTemplate: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/console/backup');
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setBackups(Array.isArray(data?.backups) ? data.backups : []);
      setPluginTabs(Array.isArray(data?.tabs) ? data.tabs : []);
      setPluginOps(Array.isArray(data?.operations) ? data.operations : []);
    } catch {
      toast('读取备份列表失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createBackup() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/console/backup', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      toast('备份已创建');
      await load();
    } catch {
      toast('创建备份失败 请检查磁盘空间', 'error');
    }
    setCreating(false);
  }

  async function removeBackup(name: string) {
    setDeleting(name);
    try {
      const res = await fetch(`/api/console/backup?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(String(res.status));
      toast('备份已删除');
      setPendingDelete(null);
      await load();
    } catch {
      toast('删除备份失败', 'error');
    }
    setDeleting(null);
  }

  async function doRestore() {
    if (!restoreFile || restoring) return;
    setRestoring(true);
    setRestoreTip('');
    try {
      const form = new FormData();
      form.append('file', restoreFile);
      const res = await fetch('/api/console/backup/restore', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `恢复失败 (${res.status})`);
      toast('数据库已恢复');
      setRestoreTip(
        `${data.message || '恢复完成'}；恢复前的自动备份为 ${data.preBackup || '未知'}`
      );
      setRestoreFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '恢复失败', 'error');
    }
    setRestoring(false);
    setConfirmRestore(false);
  }

  return (
    <div className="space-y-6">
      {/* 备份操作卡片 */}
        <div className="rounded-lg border border-line bg-bg p-6 sm:p-8 anim-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 anim-scale-in">
              <Database className="h-8 w-8 text-primary" strokeWidth={1.5} />
            </span>
            <div className="mt-4 min-w-0 flex-1 sm:ml-6 sm:mt-0">
              <h2 className="text-lg font-bold">数据库备份</h2>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                在线备份主库 统计库 插件数据库与插件数据 恢复前会自动备份当前数据
              </p>
            </div>
            <div className="mt-5 flex shrink-0 flex-wrap items-center justify-center gap-2 sm:ml-6 sm:mt-0">
              <button
                type="button"
                onClick={createBackup}
                disabled={creating}
                className="liquid-btn inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4" />}
                {creating ? '备份中' : '立即备份'}
              </button>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:border-primary hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新列表
              </button>
            </div>
          </div>
        </div>

        {/* 备份列表 */}
        <section className="rounded-lg border border-line bg-bg anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">备份记录</h3>
            <span className="ml-auto text-xs text-fg-muted">{backups.length} 份</span>
          </div>

          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-fg-muted">
              <Database className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <p className="mt-2 text-xs">还没有备份 点击「立即备份」创建第一份</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {backups.map((b) => (
                <div
                  key={b.name}
                  className="flex flex-col gap-3 px-4 py-3 transition-colors duration-200 hover:bg-bg-secondary sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm">{b.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                          b.type === 'auto'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-bg-secondary text-fg-muted'
                        }`}
                      >
                        {b.type === 'auto' ? '自动' : '手动'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                      <span>{formatTime(b.createdAt)}</span>
                      <span>{formatSize(b.size)}</span>
                      {b.files.length > 0 && <span className="truncate">{b.files.join(' / ')}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/api/console/backup?name=${encodeURIComponent(b.name)}`}
                      className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                    >
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </a>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(b.name)}
                      disabled={deleting === b.name}
                      className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs text-red-500 transition-all duration-200 hover:border-red-300 hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting === b.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      删除
                    </button>
                    {pluginOps.map((op) => (
                      <a
                        key={op.label}
                        href={op.hrefTemplate.replace('{name}', encodeURIComponent(b.name))}
                        className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
                      >
                        {op.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 插件扩展 Tab（backupTab） */}
        {pluginTabs.length > 0 && (
          <section className="rounded-lg border border-line bg-bg p-4 anim-fade-in-up">
            <div className="mb-2 flex flex-wrap gap-1 border-b border-line pb-2">
              {pluginTabs.map((t) => (
                <button
                  key={`${t.pluginSlug}:${t.key}`}
                  type="button"
                  onClick={() => setPluginTab(t.key)}
                  className={`rounded px-3 py-1.5 text-sm transition-colors ${
                    (pluginTab || pluginTabs[0]?.key) === t.key ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-bg-secondary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div
              className="text-sm"
              dangerouslySetInnerHTML={{
                __html: (pluginTabs.find((t) => t.key === pluginTab) ?? pluginTabs[0])?.html ?? '',
              }}
            />
          </section>
        )}

        {/* 恢复备份 */}
        <section className="rounded-lg border border-line bg-bg p-5 anim-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <RotateCcw className="h-4 w-4 text-primary" />
            恢复备份
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
            支持上传单个 .db 文件或本站导出的备份 zip 恢复前会自动备份当前数据库
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={fileRef}
              type="file"
              accept=".db,.zip"
              onChange={(e) => {
                setRestoreFile(e.target.files?.[0] ?? null);
                setRestoreTip('');
              }}
              className="block w-full text-sm text-fg-muted file:mr-3 file:cursor-pointer file:rounded file:border file:border-line file:bg-bg-secondary file:px-3 file:py-2 file:text-sm file:text-fg hover:file:border-primary hover:file:text-primary"
            />
            <button
              type="button"
              onClick={() => setConfirmRestore(true)}
              disabled={!restoreFile || restoring}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-red-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-red-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {restoring ? '恢复中' : '开始恢复'}
            </button>
          </div>
          {restoreTip && (
            <div className="mt-3 flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{restoreTip}</span>
            </div>
          )}
        </section>

        {/* 提示 */}
        <div className="rounded-lg border border-line bg-bg p-4 sm:p-5 anim-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Info className="h-4 w-4 text-primary" />
            备份须知
          </h3>
          <ul className="mt-3 space-y-2.5 stagger">
            {TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* 底部提示条 */}
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-line px-4 py-3.5 text-xs leading-relaxed text-fg-muted anim-fade-in" style={{ animationDelay: '0.25s' }}>
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            恢复成功后建议重启服务 确保所有数据库连接都指向新库 自动备份由「系统设置 → 定时备份」控制
          </span>
        </div>

        <ConfirmDialog
          open={pendingDelete !== null}
          title="删除备份"
          message={`确定删除备份「${pendingDelete ?? ''}」吗？该操作不可撤销。`}
          confirmText="删除"
          loading={deleting !== null}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete) removeBackup(pendingDelete);
          }}
        />

        <ConfirmDialog
          open={confirmRestore}
          title="恢复数据库"
          message={
            restoreFile
              ? `将用「${restoreFile.name}」覆盖当前数据库，系统会先自动备份当前数据。恢复期间站点可能出现短暂异常，确定继续？`
              : '确定恢复数据库吗？'
          }
          confirmText="确认恢复"
          loading={restoring}
          onCancel={() => setConfirmRestore(false)}
          onConfirm={doRestore}
        />
    </div>
  );
}
