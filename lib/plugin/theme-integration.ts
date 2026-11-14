// lib/plugin/theme-integration.ts — Halo 风格"主题优先"插件模板解析
// 主题可以覆盖插件模板：scripts/themes/{slug}/templates/plugins/{pluginSlug}/{name}.tsx
import fs from 'node:fs';
import path from 'node:path';
import { getActiveTheme } from '../theme';

export async function resolvePluginTemplate(
  pluginSlug: string,
  templateName: string
): Promise<unknown | null> {
  const THEMES_DIR = path.join(process.cwd(), 'scripts', 'themes');
  const PLUGINS_DIR = path.join(process.cwd(), 'scripts', 'plugins');

  // 1. 先查当前激活主题有没有覆盖这个模板
  const activeTheme = await getActiveTheme();
  if (activeTheme) {
    const themeOverridePath = path.join(
      THEMES_DIR,
      activeTheme.slug,
      'templates',
      'plugins',
      pluginSlug,
      `${templateName}.tsx`
    );
    if (fs.existsSync(themeOverridePath)) {
      return import(themeOverridePath);
    }
  }

  // 2. 回退：用插件自带的默认模板
  const pluginTemplatePath = path.join(
    PLUGINS_DIR,
    pluginSlug,
    'templates',
    `${templateName}.tsx`
  );
  if (fs.existsSync(pluginTemplatePath)) {
    return import(pluginTemplatePath);
  }

  return null; // 都没有 → 显示"插件模板缺失"
}
