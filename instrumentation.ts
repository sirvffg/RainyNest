// instrumentation.ts — Next.js 启动钩子（Node Runtime）
// 插件系统启动 + 访问统计定时任务
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootPlugins } = await import('./lib/plugin/engine');
    const { startAnalyticsScheduler } = await import('./lib/analytics/scheduler');

    try {
      await bootPlugins();
    } catch (err) {
      console.error('[Instrumentation] bootPlugins failed:', err);
    }
    try {
      startAnalyticsScheduler();
    } catch (err) {
      console.error('[Instrumentation] startAnalyticsScheduler failed:', err);
    }
  }
}
