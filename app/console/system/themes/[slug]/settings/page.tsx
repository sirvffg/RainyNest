// app/console/system/themes/[slug]/settings/page.tsx — 主题独立设置页（服务端读 schema + DB 配置）
import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Palette } from 'lucide-react';
import { db } from '@/lib/prisma';
import { mergeWithDefault } from '@/lib/theme';
import ThemeSettingsForm from './ThemeSettingsForm';

export const runtime = 'nodejs';

type Props = { params: Promise<{ slug: string }> };

export default async function ThemeSettingsPage({ params }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) notFound();

  const jsonPath = path.join(process.cwd(), 'scripts', 'themes', slug, 'theme.json');
  if (!fs.existsSync(jsonPath)) notFound();

  let meta: { name?: string; configSchema?: Record<string, unknown> } = {};
  try {
    meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    notFound();
  }

  // 读取 DB 中已保存的配置，与 schema 默认值合并
  let stored: Record<string, unknown> = {};
  try {
    const dbTheme = await db.theme.findUnique({ where: { slug } });
    if (dbTheme?.config) stored = JSON.parse(dbTheme.config);
  } catch {
    stored = {};
  }

  const schema = (meta.configSchema ?? {}) as Record<string, { label?: string; fields?: Record<string, any> }>;
  const config = mergeWithDefault(schema, stored);

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="anim-fade-in-up flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/console/system/themes"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-line text-fg-muted transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
            aria-label="返回主题列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Palette className="h-4 w-4 text-primary" />
              主题设置 · {meta.name || slug}
            </h1>
            <p className="mt-0.5 text-xs text-fg-muted">保存后立即应用到站点外观</p>
          </div>
        </div>
      </div>

      <ThemeSettingsForm
        slug={slug}
        schema={schema}
        initialConfig={config}
      />
    </div>
  );
}
