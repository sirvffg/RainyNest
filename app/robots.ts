// app/robots.ts — robots.txt
import type { MetadataRoute } from 'next';
import { getSiteSetting } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteSetting();
  const base = (site?.url || 'http://localhost:3000').replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/console', '/api', '/signin'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
