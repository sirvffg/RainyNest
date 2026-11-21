// app/api/console/settings/route.ts — 站点设置读取 / 保存
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, requirePermission } from '@/lib/api-auth';
import { getSiteSetting, saveSiteSetting } from '@/lib/site';
import { db } from '@/lib/prisma';
import { clearThemeCache } from '@/lib/theme';
import type { SiteSetting } from '@prisma/client';

// 密钥字段：GET 一律脱敏为空串 + hasXxx 标记；PUT 传空 / 掩码时保留数据库原值
const SECRET_FIELDS = [
  'smtpPass',
  'oauthGithubSecret',
  'oauthGoogleSecret',
  'oauthWechatSecret',
  'ldapBindPassword',
] as const;

/** 返回给前端的设置：密钥字段置空，仅暴露是否已设置 */
function maskSecrets(site: SiteSetting) {
  const payload: Record<string, unknown> = { ...site };
  for (const key of SECRET_FIELDS) {
    payload[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`] = Boolean(site[key]);
    payload[key] = '';
  }
  return payload;
}

// GET（登录即可读）
export async function GET() {
  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const site = await getSiteSetting();
  return NextResponse.json(maskSecrets(site));
}

// PUT（需站点配置权限 site:config）— 只允许 SiteSetting 已有字段，多余字段直接丢弃
const settingSchema = z
  .object({
    title: z.string().max(100).optional(),
    subtitle: z.string().max(200).optional().nullable(),
    description: z.string().max(500).optional(),
    url: z.string().max(500).optional(),
    logo: z.string().optional().nullable(),
    favicon: z.string().optional().nullable(),
    icp: z.string().optional().nullable(),
    footerText: z.string().optional().nullable(),
    keywords: z.string().optional().nullable(),
    author: z.string().optional().nullable(),
    googleVerification: z.string().optional().nullable(),
    baiduVerification: z.string().optional().nullable(),
    githubUrl: z.string().optional().nullable(),
    twitterUrl: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    allowRegister: z.boolean().optional(),
    commentModeration: z.boolean().optional(),
    enableRss: z.boolean().optional(),
    enableSitemap: z.boolean().optional(),
    codeShowLineNumbers: z.boolean().optional(),
    codeCollapsible: z.boolean().optional(),
    codeCollapseThreshold: z.number().int().min(0).max(200).optional(),
    codeLanguageBadge: z.boolean().optional(),
    enableCallouts: z.boolean().optional(),
    enableMath: z.boolean().optional(),
    enableWikiLink: z.boolean().optional(),
    enableReadingTime: z.boolean().optional(),
    enableEmailProtection: z.boolean().optional(),
    enableSectionize: z.boolean().optional(),
    codeTabGroup: z.boolean().optional(),
    enableFigure: z.boolean().optional(),
    enableMermaid: z.boolean().optional(),
    enablePlantuml: z.boolean().optional(),
    smtpHost: z.string().optional().nullable(),
    smtpPort: z.number().int().min(0).max(65535).optional().nullable(),
    smtpUser: z.string().optional().nullable(),
    smtpPass: z.string().optional().nullable(),
    smtpFrom: z.string().optional().nullable(),
    primaryColor: z.string().optional().nullable(),
    ipSource: z.enum(['auto', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'direct', 'custom']).optional(),
    ipCustomHeader: z.string().max(100).optional().nullable(),
    // 运维 / 第三方登录 / LDAP
    autoBackupCron: z.string().max(120).optional().nullable(),
    autoBackupKeep: z.number().int().min(1).max(365).optional(),
    allowThemeGitInstall: z.boolean().optional(),
    oauthGithubId: z.string().max(200).optional().nullable(),
    oauthGithubSecret: z.string().max(300).optional().nullable(),
    oauthGoogleId: z.string().max(200).optional().nullable(),
    oauthGoogleSecret: z.string().max(300).optional().nullable(),
    oauthWechatId: z.string().max(200).optional().nullable(),
    oauthWechatSecret: z.string().max(300).optional().nullable(),
    enableLdap: z.boolean().optional(),
    ldapUrl: z.string().max(300).optional().nullable(),
    ldapBindDn: z.string().max(300).optional().nullable(),
    ldapBindPassword: z.string().max(300).optional().nullable(),
    ldapBaseDn: z.string().max(300).optional().nullable(),
    ldapUserFilter: z.string().max(300).optional().nullable(),
  })
  .strip();

export async function PUT(req: NextRequest) {
  const check = await requirePermission('site:config');
  if (check) return check;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = settingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }

  try {
    const data = { ...parsed.data };
    // 密钥字段：空串 / null 视为「未修改」，保留数据库已有值，避免脱敏导致密钥被清空
    for (const key of SECRET_FIELDS) {
      const value = data[key];
      if (value === undefined) continue;
      if (value === null || value.trim() === '') delete data[key];
    }

    const site = await saveSiteSetting(data);

    // 主色同步写入当前主题配置：外观页改色后刷新依然生效（SSR 由主题 cssVars 注入）
    const color = parsed.data.primaryColor;
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
      try {
        const active = await db.theme.findFirst({ where: { isActive: true } });
        if (active) {
          let cfg: Record<string, unknown> = {};
          try {
            cfg = active.config ? (JSON.parse(active.config) as Record<string, unknown>) : {};
          } catch {
            cfg = {};
          }
          cfg.basic = { ...((cfg.basic as Record<string, unknown>) ?? {}), primaryColor: color };
          await db.theme.update({ where: { id: active.id }, data: { config: JSON.stringify(cfg) } });
          clearThemeCache();
        }
      } catch (err) {
        console.error('[api/console/settings] sync theme primary color failed:', err);
      }
    }

    revalidatePath('/', 'layout');
    return NextResponse.json(maskSecrets(site));
  } catch (err) {
    console.error('[api/console/settings] save failed:', err);
    return NextResponse.json({ error: '保存站点设置失败' }, { status: 500 });
  }
}
