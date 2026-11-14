// vendor/plugins/page-views/index.ts — PV 统计（插件独立库 path_views 表）
import type { PluginContext, ExtensionHandlers } from '@/lib/plugin/types';
import React from 'react';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS path_views (
  path TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
`;

export default function pageViewsPlugin(ctx: PluginContext): ExtensionHandlers {
  function ensureTable() {
    ctx.pluginDb.exec(CREATE_TABLE_SQL);
  }

  return {
    // 启动时建表兜底
    onMount() {
      ensureTable();
      ctx.logger.info('path_views 表已就绪');
    },

    // 每次页面浏览：UPSERT 计数
    onPageView({ path }) {
      if (!path) return;
      ensureTable();
      const now = new Date().toISOString();
      ctx.pluginDb
        .prepare(
          `INSERT INTO path_views (path, count, updated_at) VALUES (?, 1, ?)
           ON CONFLICT(path) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`
        )
        .run(path, now);
    },

    // 后台扩展页面：注入控制台菜单 + 独立管理页
    customAdminRoutes: [
      {
        path: 'stats',
        title: '访问统计',
        group: '工具',
        component: () => import('./admin.js'),
      },
    ],

    // 文章保存成功后：记录日志（示例）
    afterSavePost(post) {
      ctx.logger.info(`文章已保存「${post.title ?? post.slug}」`);
    },

    // 文章列表行操作按钮（链接型，{id}/{slug} 占位符）
    postListItemOperation: [
      {
        label: '浏览明细',
        icon: 'eye',
        variant: 'outline',
        onClick: '/console/plugin-ext/page-views/stats?postId={id}',
      },
    ],

    // 仪表盘小部件（闭包组件：可直接读插件库，同步渲染）
    dashboardWidget: [
      {
        title: '插件 PV 统计',
        icon: 'bar-chart',
        component: function PvWidget() {
          let total = 0;
          try {
            const row = ctx.pluginDb.prepare('SELECT COUNT(*) AS c FROM path_views').get() as { c: number };
            total = row?.c ?? 0;
          } catch { /* 表未初始化 */ }
          return React.createElement(
            'div',
            null,
            React.createElement('div', { style: { fontSize: 13, color: '#64748b', marginBottom: 6 } }, '累计 PV（page-views）'),
            React.createElement('div', { style: { fontSize: 26, fontWeight: 700, lineHeight: 1.2 } }, String(total)),
            React.createElement('div', { style: { fontSize: 12, color: '#94a3b8', marginTop: 8 } }, '打开「工具 → 访问统计」查看明细')
          );
        },
      },
    ],

    // 前台页脚注入：统计标记
    injectFooter() {
      return ['<!-- page-views active -->'];
    },

    customApi: [
      {
        method: 'GET',
        path: '/count',
        auth: false,
        handler: async (req: Request) => {
          ensureTable();
          const path = new URL(req.url).searchParams.get('path');
          if (!path) {
            return new Response(JSON.stringify({ error: 'missing path' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            });
          }
          const row = ctx.pluginDb
            .prepare('SELECT count FROM path_views WHERE path = ?')
            .get(path) as { count: number } | undefined;
          return new Response(
            JSON.stringify({ path, count: row?.count ?? 0 }),
            { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
          );
        },
      },
    ],
  };
}
