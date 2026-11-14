import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import { getSiteSetting } from '@/lib/site';
import { getActiveTheme } from '@/lib/theme';
import AnalyticsBeacon from '@/components/analytics/AnalyticsBeacon';
import PluginHead from '@/components/layout/PluginHead';
import { Suspense } from 'react';

export async function generateMetadata(): Promise<Metadata> {
  const [site, theme] = await Promise.all([getSiteSetting(), getActiveTheme()]);
  const url = site?.url || 'http://localhost:3000';

  return {
    metadataBase: new URL(url),
    title: {
      default: site?.title || 'RainyNest',
      template: `%s | ${site?.title || 'RainyNest'}`,
    },
    description: site?.description,
    keywords: site?.keywords?.split(',').map((s) => s.trim()).filter(Boolean) || [],
    verification: {
      google: site?.googleVerification || undefined,
      other: site?.baiduVerification ? { baidu: site.baiduVerification } : undefined,
    },
    openGraph: {
      type: 'website',
      siteName: site?.title || 'RainyNest',
      url,
    },
    icons: site?.favicon ? { icon: site.favicon } : undefined,
  };
}

export const viewport = {
  colorScheme: 'light',
};

// 主题 CSS 变量（动态生成，SSR 内联注入）
async function ThemeStyle() {
  const theme = await getActiveTheme();
  const cssVars = theme?.cssVars || {};
  const varLines = Object.entries(cssVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');

  return (
    <>
      <link rel="stylesheet" href={`/themes/${theme?.slug || 'default'}/theme.css`} />
      {varLines && (
        <style id="theme-dynamic-vars">{`:root {\n  ${varLines}\n}`}</style>
      )}
      {theme?.customCss && <style id="theme-custom-css">{theme.customCss}</style>}
      {theme?.customJs && <script id="theme-custom-js" dangerouslySetInnerHTML={{ __html: theme.customJs }} />}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Suspense fallback={null}>
          <ThemeStyle />
        </Suspense>
        {/* 插件 injectHead 扩展点（站长验证 meta、代码高亮 CSS 等） */}
        <Suspense fallback={null}>
          <PluginHead />
        </Suspense>
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Suspense fallback={null}>
          <AnalyticsBeacon />
        </Suspense>
      </body>
    </html>
  );
}
