// lib/search/default-provider.ts — 默认搜索引擎（SQLite FTS5）
// 插件 searchProvider 扩展点可以替换它（firstWins）
import { db } from '../prisma';
import type { SearchProvider, SearchResult } from '../plugin/types';

export const defaultSearchProvider: SearchProvider = {
  name: 'fts5',
  builtIn: true,

  async search(query: string, options?: { limit?: number; offset?: number }): Promise<SearchResult[]> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    try {
      const rows = await db.$queryRaw<SearchResult[]>`
        SELECT p.id, p.title, p.slug, p.summary,
               snippet(post_fts, 2, '<mark>', '</mark>', '...') as snippet,
               bm25(post_fts) as score
        FROM post_fts
        JOIN Post p ON p.rowid = post_fts.rowid
        WHERE post_fts MATCH ${query.replace(/['"]/g, ' ')}
          AND p.status = 'PUBLISHED'
        ORDER BY score
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows;
    } catch {
      // FTS 表未初始化时降级为 LIKE 搜索
      const posts = await db.post.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: query } },
            { summary: { contains: query } },
            { content: { contains: query } },
          ],
        },
        select: { id: true, title: true, slug: true, summary: true },
        take: limit,
        skip: offset,
      });
      return posts.map((p) => ({ ...p, snippet: p.summary ?? '', score: 0 }));
    }
  },
};

// 获取当前搜索提供者（插件可覆盖）
export async function getSearchProvider(): Promise<SearchProvider> {
  try {
    const { getPluginSearchProvider } = await import('../plugin/engine');
    const pluginProvider = await getPluginSearchProvider();
    if (pluginProvider) return pluginProvider;
  } catch { /* 插件系统未就绪 */ }
  return defaultSearchProvider;
}
