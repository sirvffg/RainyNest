// lib/analytics/scheduler.ts — 自托管模式：node-cron 进程内常驻调度
import cron from 'node-cron';
import { runMinuteAggregation } from './aggregator';

const g = globalThis as unknown as { __rnSchedulerStarted?: boolean };

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

  console.log('[Analytics] Scheduler started (every minute)');
}
