// lib/analytics/scheduler.ts — 自托管模式：node-cron 进程内常驻调度
import cron from 'node-cron';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runMinuteAggregation } from './aggregator';

const g = globalThis as unknown as { __rnSchedulerStarted?: boolean };

// 定期把 WAL 日志合并回主库并截断（防止 -wal / -shm 文件无限增长）
// TRUNCATE 模式：合并成功后 -wal 文件清零，主库文件保持自包含，便于备份
function checkpointWal() {
  for (const name of ['blog.db', 'analytics.db']) {
    let conn: Database.Database | null = null;
    try {
      conn = new Database(path.join(process.cwd(), 'db', name), { timeout: 5000 });
      const rows = conn.pragma('wal_checkpoint(TRUNCATE)') as {
        busy: number;
        log: number;
        checkpointed: number;
      }[];
      const r = rows[0];
      if (r && r.log > 0) {
        console.log(`[DB] ${name} WAL 合并：${r.checkpointed}/${r.log} 页写回主库`);
      }
    } catch (err) {
      console.error(`[DB] ${name} WAL checkpoint failed:`, err);
    } finally {
      conn?.close();
    }
  }
}

// 进程退出前最后合并一次（'exit' 回调只能同步操作，better-sqlite3 恰好是同步 API）
let exitHookInstalled = false;
function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on('exit', () => {
    try {
      checkpointWal();
      console.log('[DB] 退出前 WAL 已合并');
    } catch { /* 退出阶段不再抛错 */ }
  });
}

export function startAnalyticsScheduler() {
  if (g.__rnSchedulerStarted) return;
  g.__rnSchedulerStarted = true;

  // 每分钟跑一次增量聚合（水位线保证不重复计数）
  cron.schedule('* * * * *', async () => {
    try {
      await runMinuteAggregation();
    } catch (err) {
      console.error('[Analytics] ✗ Aggregation failed:', err);
    }
  });

  // 每 30 分钟合并一次 WAL（两个库）
  cron.schedule('*/30 * * * *', () => {
    checkpointWal();
  });

  // 进程退出前最后合并一次
  installExitHook();

  // 启动时先合并一次
  checkpointWal();

  console.log('[Analytics] Scheduler started (every minute)');
}
