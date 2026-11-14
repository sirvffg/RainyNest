// app/sitemap.ts — sitemap.xml（SiteSetting.enableSitemap 开关）
import type { MetadataRoute } from 'next';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteSetting();
  const base = (site?.url || 'http://localhost:3000').replace(/\/$/, '');

  if (site && !site.enableSitemap) return [];

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/links`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/archive`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  try {
    const posts = await db.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });
    for (const post of posts) {
      entries.push({
        url: `${base}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch { /* 数据库未就绪 */ }

  return entries;
}
