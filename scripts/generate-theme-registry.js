// scripts/generate-theme-registry.js — 生成主题模板静态注册表
//
// 为什么需要：主题模板若走运行时 esbuild 编译，Next 构建器不知道它的存在，
// 无法支持 `@/` 路径别名与 `'use client'` 组件（不会进入客户端 manifest）。
// 这里在 dev/build 前扫描 scripts/themes/*/templates/*.tsx，生成静态 import 注册表，
// 让已安装主题的模板按正常模块参与 Next 编译。
//
// 新安装、尚未重启的主题仍由 lib/theme/templates.ts 运行时编译兜底。
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const THEMES_DIR = path.join(ROOT, 'scripts', 'themes');
const OUT_FILE = path.join(ROOT, 'lib', 'theme', 'generated-templates.ts');

const SLUG_RE = /^[a-zA-Z0-9._-]+$/;
const TEMPLATE_RE = /^[a-z][a-z0-9-]*\.tsx$/;

/** esbuild 语法预检，坏模板跳过，避免一个主题拖垮整个构建 */
function syntaxOk(absPath) {
  try {
    const esbuild = require('esbuild');
    esbuild.transformSync(fs.readFileSync(absPath, 'utf8'), {
      loader: 'tsx',
      jsx: 'automatic',
      format: 'cjs',
      target: 'node18',
    });
    return true;
  } catch (err) {
    console.warn(`[theme-registry] ⚠ 跳过语法错误的模板 ${path.relative(ROOT, absPath)}: ${err.message}`);
    return false;
  }
}

const entries = [];
if (fs.existsSync(THEMES_DIR)) {
  for (const themeDir of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
    if (!themeDir.isDirectory()) continue;
    const slug = themeDir.name;
    // 跳过安装器备份/待删目录
    if (/(\.bak-\d+|\.deleted-\d+)$/.test(slug) || !SLUG_RE.test(slug)) continue;

    const tplDir = path.join(THEMES_DIR, slug, 'templates');
    if (!fs.existsSync(tplDir)) continue;

    for (const file of fs.readdirSync(tplDir, { withFileTypes: true })) {
      if (!file.isFile() || !TEMPLATE_RE.test(file.name)) continue;
      const absPath = path.join(tplDir, file.name);
      if (!syntaxOk(absPath)) continue;
      entries.push({ slug, name: file.name.replace(/\.tsx$/, ''), rel: `../../scripts/themes/${slug}/templates/${file.name.replace(/\.tsx$/, '')}` });
    }
  }
}

const imports = entries
  .map((entry, i) => `import * as themeTpl${i} from '${entry.rel}';`)
  .join('\n');

const byTheme = new Map();
entries.forEach((entry, i) => {
  if (!byTheme.has(entry.slug)) byTheme.set(entry.slug, []);
  byTheme.get(entry.slug).push(`    '${entry.name}': themeTpl${i},`);
});

const registry = [...byTheme.entries()]
  .map(([slug, lines]) => `  '${slug}': {\n${lines.join('\n')}\n  },`)
  .join('\n');

const content = `// 此文件由 scripts/generate-theme-registry.js 自动生成，请勿手动修改。
// dev/build 前会自动重新生成；新增主题模板后需重启 dev 或重新 build 才能获得
// @/ 别名与 'use client' 支持（未重启时由运行时编译兜底，仅支持服务端模板）。
${imports}

export const themeTemplateRegistry: Record<string, Record<string, unknown>> = {
${registry}
};
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const prev = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
if (prev !== content) {
  fs.writeFileSync(OUT_FILE, content);
  console.log(`[theme-registry] ✓ 已注册 ${entries.length} 个主题模板`);
} else {
  console.log(`[theme-registry] ✓ 主题模板无变化（${entries.length} 个）`);
}
