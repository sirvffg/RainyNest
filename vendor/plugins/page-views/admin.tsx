// vendor/plugins/page-views/admin.tsx — 插件后台页面示例（RSC 服务端渲染）
// 交互走 <form> + customApi，保持服务端组件兼容
import Database from 'better-sqlite3';
import path from 'node:path';

interface Row {
  path: string;
  count: number;
  updated_at: string | null;
}

function loadData(): { rows: Row[]; total: number } {
  try {
    const db = new Database(
      path.join(process.cwd(), 'db', 'plugins', 'page-views.db'),
      { readonly: true }
    );
    const rows = db
      .prepare('SELECT path, count, updated_at FROM path_views ORDER BY count DESC LIMIT 20')
      .all() as Row[];
    const total = db.prepare('SELECT COALESCE(SUM(count), 0) AS c FROM path_views').get() as {
      c: number;
    };
    db.close();
    return { rows, total: total.c };
  } catch {
    return { rows: [], total: 0 };
  }
}

export default function PageViewsAdminPage() {
  const { rows, total } = loadData();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-bg-secondary p-4">
          <p className="text-xs text-fg-muted">总浏览量</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{total}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-secondary p-4">
          <p className="text-xs text-fg-muted">被统计路径</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{rows.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-left text-xs text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">路径</th>
              <th className="px-4 py-2 font-medium">浏览次数</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">最近浏览</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.path} className="border-t border-line">
                <td className="max-w-[16rem] truncate px-4 py-2 font-mono text-xs">{row.path}</td>
                <td className="px-4 py-2 tabular-nums">{row.count}</td>
                <td className="hidden px-4 py-2 text-xs text-fg-muted sm:table-cell">
                  {row.updated_at ? new Date(row.updated_at).toLocaleString('zh-CN') : '-'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-fg-muted">
                  暂无浏览数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
