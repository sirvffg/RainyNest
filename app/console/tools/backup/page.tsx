'use client';

import { CircleAlert, Database, Download, Info, RefreshCcw } from 'lucide-react';
import ToastProvider from '@/components/admin/Toast';

const TIPS = [
  '备份文件为站点完整数据库快照 包含文章 评论 用户与全部设置',
  '备份包含密码哈希等敏感信息 请妥善保管 避免外传',
  '建议在更新版本或大改动前先执行一次备份',
  '恢复时用备份文件替换站点数据库文件即可',
];

export default function BackupPage() {
  return (
    <ToastProvider>
      <div className="space-y-6">
        {/* 页头 */}
        <div className="anim-fade-in-up">
          <h1 className="text-2xl font-bold">备份</h1>
          <p className="mt-1 text-sm text-fg-muted">一键导出全站数据 安全稳妥</p>
        </div>

        {/* 备份卡片 */}
        <div className="rounded-lg border border-line bg-bg p-6 sm:p-8 anim-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 anim-scale-in">
              <Database className="h-8 w-8 text-primary" strokeWidth={1.5} />
            </span>
            <div className="mt-4 min-w-0 flex-1 sm:ml-6 sm:mt-0">
              <h2 className="text-lg font-bold">数据库备份</h2>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                下载当前站点的完整数据库文件 建议定期备份 防患于未然
              </p>
            </div>
            <a
              href="/api/console/backup"
              download
              className="liquid-btn mt-5 inline-flex shrink-0 items-center gap-2 sm:ml-6 sm:mt-0"
            >
              <Download className="h-4 w-4" />
              下载数据库备份
            </a>
          </div>
        </div>

        {/* 提示 */}
        <div className="rounded-lg border border-line bg-bg p-4 sm:p-5 anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
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
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-line px-4 py-3.5 text-xs leading-relaxed text-fg-muted anim-fade-in" style={{ animationDelay: '0.15s' }}>
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            备份由服务端实时生成 点击下载即得到最新数据 若下载失败请检查服务器磁盘空间
            <RefreshCcw className="ml-1 inline h-3 w-3" />
            恢复操作需在服务器上手动完成
          </span>
        </div>
      </div>
    </ToastProvider>
  );
}
