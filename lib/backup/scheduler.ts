// lib/backup/scheduler.ts — 定时备份调度（node-cron 进程内常驻）
// 读取 SiteSetting.autoBackupCron：为空则关闭；配置变化时自动重建任务
import cron, { type ScheduledTask } from 'node-cron';
import { createBackup } from './index';
import { getSiteSetting } from '../site';

const g = globalThis as unknown as {
  __rnBackupSchedulerStarted?: boolean;
  __rnBackupTask?: ScheduledTask | null;
  __rnBackupExpr?: string;
};

export function startBackupScheduler() {
  if (g.__rnBackupSchedulerStarted) return;
  g.__rnBackupSchedulerStarted = true;

  // 每分钟（以及启动时）同步一次 cron 配置，配置变更后自动重建任务
  const sync = async () => {
    try {
      const site = await getSiteSetting();
      const expr = (site.autoBackupCron || '').trim();

      if (expr === (g.__rnBackupExpr ?? '')) return;

      try {
        g.__rnBackupTask?.stop();
      } catch { /* ignore */ }
      g.__rnBackupTask = null;
      g.__rnBackupExpr = expr;

      if (!expr) {
        console.log('[Backup] 自动备份未启用');
        return;
      }
      if (!cron.validate(expr)) {
        console.error(`[Backup] 无效的 cron 表达式：${expr}`);
        return;
      }

      g.__rnBackupTask = cron.schedule(expr, async () => {
        try {
          // 每次执行时重新读取保留份数，避免使用旧闭包
          const current = await getSiteSetting();
          const meta = await createBackup({ type: 'auto', keep: current.autoBackupKeep });
          console.log(`[Backup] ✓ 自动备份完成：${meta.name}（${meta.size} 字节）`);
        } catch (err) {
          console.error('[Backup] ✗ 自动备份失败:', err);
        }
      });

      console.log(`[Backup] 自动备份已启用：${expr}`);
    } catch (err) {
      console.error('[Backup] 调度器同步失败:', err);
    }
  };

  void sync();
  const timer = setInterval(sync, 60_000);
  timer.unref?.();
}
