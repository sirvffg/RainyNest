// lib/site.ts — 站点设置读写（带缓存）
// 前台/插件所有配置读取都走这里，避免每次请求都查库
import { db } from './prisma';
import type { SiteSetting } from '@prisma/client';

// 默认值（数据库为空 / 首次构建时兜底，保证 build 不炸）
export const DEFAULT_SITE_SETTING: SiteSetting = {
  id: 'default',
  title: 'RainyNest',
  subtitle: null,
  description: '一个关于技术与生活的博客',
  url: 'http://localhost:3000',
  logo: null,
  favicon: null,
  icp: null,
  footerText: null,
  keywords: null,
  author: null,
  googleVerification: null,
  baiduVerification: null,
  githubUrl: null,
  twitterUrl: null,
  email: null,
  allowRegister: false,
  commentModeration: true,
  enableRss: true,
  enableSitemap: true,
  codeShowLineNumbers: true,
  codeCollapsible: true,
  codeCollapseThreshold: 15,
  codeLanguageBadge: true,
  enableCallouts: true,
  enableMath: true,
  enableWikiLink: false,
  enableReadingTime: true,
  enableEmailProtection: true,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPass: null,
  smtpFrom: null,
  primaryColor: '#3b82f6',
  ipSource: 'auto',
  ipCustomHeader: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CACHE_KEY = Symbol.for('rainynest.siteSetting');

type CacheStore = { [CACHE_KEY]?: { value: SiteSetting; at: number } };
const g = globalThis as unknown as CacheStore;

const CACHE_TTL_MS = 60_000; // 60s 软缓存，后台保存时主动清除

export async function getSiteSetting(): Promise<SiteSetting> {
  const cached = g[CACHE_KEY];
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const site = await db.siteSetting.findUnique({ where: { id: 'default' } });
    const value = site ?? DEFAULT_SITE_SETTING;
    g[CACHE_KEY] = { value, at: Date.now() };
    return value;
  } catch {
    // 数据库不可用（首次构建等）→ 返回默认值
    return DEFAULT_SITE_SETTING;
  }
}

export async function saveSiteSetting(data: Partial<SiteSetting>): Promise<SiteSetting> {
  const site = await db.siteSetting.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });
  clearSiteSettingCache();
  return site;
}

export function clearSiteSettingCache() {
  delete g[CACHE_KEY];
}
