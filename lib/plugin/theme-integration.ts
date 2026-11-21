// lib/plugin/theme-integration.ts — Halo 风格"主题优先"插件模板解析
// 主题可以覆盖插件模板：scripts/themes/{slug}/templates/plugins/{pluginSlug}/{name}.tsx
// 已安装模板优先走构建期注册表（支持 @/ 与 'use client'），未重启时回退运行时编译。
import path from 'node:path';
import { resolvePluginSourceTemplate, resolveThemeTemplate } from '../theme/templates';

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function resolvePluginTemplate(
  pluginSlug: string,
  templateName: string
): Promise<unknown | null> {
  // 插件 slug / 模板名只允许安全字符，避免路径穿越
  if (!NAME_RE.test(pluginSlug) || !NAME_RE.test(templateName)) return null;

  // 1. 先查当前激活主题有没有覆盖这个模板（编译失败则继续回退）
  try {
    const override = await resolveThemeTemplate(
      path.join('plugins', pluginSlug, `${templateName}.tsx`),
      `plugin-${pluginSlug}-${templateName}`
    );
    if (override) return override;
  } catch (err) {
    console.error(`[Theme] 插件模板覆盖加载失败，回退插件默认模板: ${pluginSlug}/${templateName}`, err);
  }

  // 2. 回退：插件自带的默认模板
  try {
    return await resolvePluginSourceTemplate(pluginSlug, templateName);
  } catch (err) {
    console.error(`[Plugin] 默认模板加载失败: ${pluginSlug}/${templateName}`, err);
  }

  return null; // 都没有 → 显示"插件模板缺失"
}
