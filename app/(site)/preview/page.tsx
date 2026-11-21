// app/(site)/preview/page.tsx — 主题在线预览
// 优先渲染目标主题的 templates/home.tsx（不复用激活主题），
// 未提供 home 模板时回退默认首页；全程不影响全站 ISR。
import Link from 'next/link';
import HomePage from '../page';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import { getThemeBySlug, getActiveTheme } from '@/lib/theme';
import {
  resolveSystemTemplateForTheme,
  type HomeTemplateProps,
  type TemplatePost,
  type TemplateSite,
} from '@/lib/theme/templates';
import PostCard from '@/components/post/PostCard';

export const dynamic = 'force-dynamic';

export default async function ThemePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme: slug } = await searchParams;
  const [target, active] = await Promise.all([
    slug ? getThemeBySlug(slug) : Promise.resolve(null),
    getActiveTheme(),
  ]);
  const theme = target ?? active;

  const varLines = Object.entries(theme?.cssVars || {})
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');

  // 目标主题的 home 模板（存在才覆盖）
  let HomeOverride: Awaited<ReturnType<typeof resolveSystemTemplateForTheme<HomeTemplateProps>>> = null;
  if (target) {
    try {
      HomeOverride = await resolveSystemTemplateForTheme<HomeTemplateProps>(target.slug, 'home');
    } catch (err) {
      console.error('[Theme] 预览 home 模板加载失败，回退默认首页:', err);
    }
  }

  let content: React.ReactNode = <HomePage />;
  if (HomeOverride) {
    const site = await getSiteSetting();
    const templateSite: TemplateSite = {
      title: site.title,
      subtitle: site.subtitle ?? null,
      description: site.description ?? null,
      logo: site.logo ?? null,
      url: site.url ?? null,
      footerText: site.footerText ?? null,
      icp: site.icp ?? null,
    };

    let posts: TemplatePost[] = [];
    let total = 0;
    try {
      const [list, count] = await Promise.all([
        db.post.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: [{ isTop: 'desc' }, { publishedAt: 'desc' }],
          take: 8,
          include: { category: { select: { name: true, slug: true } } },
        }),
        db.post.count({ where: { status: 'PUBLISHED' } }),
      ]);
      posts = list;
      total = count;
    } catch { /* 数据库未就绪 */ }

    const Template = HomeOverride.default;
    content = (
      <Template
        site={templateSite}
        posts={posts}
        total={total}
        slots={{
          posts: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
              {posts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
          ),
        }}
      />
    );
  }

  return (
    <>
      {theme && <link rel="stylesheet" href={`/themes/${theme.slug}/theme.css`} />}
      {varLines && <style id="theme-preview-vars">{`:root {\n  ${varLines}\n}`}</style>}
      {theme?.customCss && <style id="theme-preview-custom-css">{theme.customCss}</style>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <span>
          主题预览：<strong>{theme?.name ?? '默认主题'}</strong>
          {!target && slug ? '（未找到该主题，已回退当前主题）' : ''}
          {HomeOverride ? '（使用主题 home 模板）' : ''}
        </span>
        <div className="flex items-center gap-2">
          <Link href="/console/system/themes" className="rounded border border-line px-3 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary">
            返回主题管理
          </Link>
          <Link href="/" className="rounded bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary-hover">
            退出预览
          </Link>
        </div>
      </div>

      <div className="theme-preview-content">{content}</div>
    </>
  );
}
