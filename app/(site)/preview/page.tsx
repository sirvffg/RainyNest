// app/(site)/preview/page.tsx — 主题在线预览
// 直接复用首页内容，注入目标主题的 CSS 变量与 theme.css，不影响全站 ISR。
import Link from 'next/link';
import HomePage from '../page';
import { getThemeBySlug, getActiveTheme } from '@/lib/theme';

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

  return (
    <>
      {theme && <link rel="stylesheet" href={`/themes/${theme.slug}/theme.css`} />}
      {varLines && <style id="theme-preview-vars">{`:root {\n  ${varLines}\n}`}</style>}
      {theme?.customCss && <style id="theme-preview-custom-css">{theme.customCss}</style>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <span>
          主题预览：<strong>{theme?.name ?? '默认主题'}</strong>
          {!target && slug ? '（未找到该主题，已回退当前主题）' : ''}
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

      <div className="theme-preview-content">
        <HomePage />
      </div>
    </>
  );
}
