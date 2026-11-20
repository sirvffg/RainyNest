// instrumentation.ts — Next.js 启动钩子
// 只在 Node Runtime 执行启动任务：插件系统、访问统计、定时备份、定时发布。
// 注意：必须把 Node-only 的 import 包在 `NEXT_RUNTIME === 'nodejs'` 的 if 块内，
// 这样 Turbopack 给 Edge 编译 instrumentation 时才能把整块静态消除；
// 用「提前 return」的写法不会做控制流 DCE，会把 adm-zip 等 Node 依赖打进 Edge 包。
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 构建阶段不启动任何常驻任务
    if (process.env.NEXT_PHASE === 'phase-production-build') return;

    try {
      const { bootPlugins } = await import('./lib/plugin/engine');
      await bootPlugins();
    } catch (err) {
      console.error('[Instrumentation] bootPlugins failed:', err);
    }

    try {
      const { startAnalyticsScheduler } = await import('./lib/analytics/scheduler');
      startAnalyticsScheduler();
    } catch (err) {
      console.error('[Instrumentation] startAnalyticsScheduler failed:', err);
    }

    try {
      const { startBackupScheduler } = await import('./lib/backup/scheduler');
      startBackupScheduler();
    } catch (err) {
      console.error('[Instrumentation] startBackupScheduler failed:', err);
    }

    // 定时发布：每分钟检查一次到点的 SCHEDULED 文章（全局标记保证只注册一次）
    try {
      const g = globalThis as unknown as { __rnPublishCronStarted?: boolean };
      if (!g.__rnPublishCronStarted) {
        g.__rnPublishCronStarted = true;
        const cron = (await import('node-cron')).default;
        const { publishScheduledPosts } = await import('./lib/cron/publish-scheduled');
        cron.schedule('* * * * *', async () => {
          try {
            await publishScheduledPosts();
          } catch (err) {
            console.error('[Instrumentation] publishScheduledPosts failed:', err);
          }
        });
        console.log('[Cron] 定时发布任务已启动（每分钟）');
      }
    } catch (err) {
      console.error('[Instrumentation] start publish cron failed:', err);
    }
  }
}
