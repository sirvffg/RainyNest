// scripts/generate-theme-registry.js — 生成主题/插件模板静态注册表
//
// 为什么需要：模板若走运行时 esbuild 编译，Next 构建器不知道它的存在，
// 无法支持 `@/` 路径别名与 `'use client'` 组件（不会进入客户端 manifest）。
// 这里在 dev/build 前扫描并生成静态 import 注册表，让已安装模板按正常模块参与 Next 编译。
//
// 覆盖范围：
//   scripts/themes/<theme>/templates/<name>.tsx            → 系统页面模板
//   scripts/themes/<theme>/templates/plugins/<p>/<n>.tsx   → 主题覆盖插件模板
//   scripts/themes/<theme>/templates/routes/<path>.tsx     → 主题自定义路由页面（/t/<path>）
//   scripts/plugins/<plugin>/templates/<name>.tsx          → 插件自带模板
//
// 未进入注册表的新装模板仍由 lib/theme/templates.ts 运行时编译兜底。
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const THEMES_DIR = path.join(ROOT, 'scripts', 'themes');
const PLUGINS_DIR = path.join(ROOT, 'scripts', 'plugins');
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

function isResidueDir(name) {
  return /(\.bak-\d+|\.deleted-\d+)$/.test(name) || !SLUG_RE.test(name);
}

/** 直接位于某目录下的模板文件（不递归） */
function directTemplates(dir, relPrefix, bucket) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!file.isFile() || !TEMPLATE_RE.test(file.name)) continue;
    const absPath = path.join(dir, file.name);
    if (!syntaxOk(absPath)) continue;
    const name = file.name.replace(/\.tsx$/, '');
    bucket.push({ key: `${relPrefix}${name}`, rel: path.relative(path.dirname(OUT_FILE), absPath).split(path.sep).join('/').replace(/\.tsx$/, '') });
  }
}

// ── 主题模板（系统页面 + 插件覆盖 + 自定义路由）────────────────
const themeEntries = new Map(); // slug → [{ key, rel }]
const themeRouteEntries = new Map(); // slug → [{ key, rel }]（templates/routes/<path>.tsx）
if (fs.existsSync(THEMES_DIR)) {
  for (const themeDir of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
    if (!themeDir.isDirectory() || isResidueDir(themeDir.name)) continue;
    const slug = themeDir.name;
    const tplDir = path.join(THEMES_DIR, slug, 'templates');
    if (!fs.existsSync(tplDir)) continue;

    const bucket = [];
    directTemplates(tplDir, '', bucket);

    // 主题覆盖插件模板：templates/plugins/<pluginSlug>/<name>.tsx
    const overrideDir = path.join(tplDir, 'plugins');
    if (fs.existsSync(overrideDir)) {
      for (const pluginDir of fs.readdirSync(overrideDir, { withFileTypes: true })) {
        if (!pluginDir.isDirectory() || isResidueDir(pluginDir.name)) continue;
        directTemplates(path.join(overrideDir, pluginDir.name), `plugins/${pluginDir.name}/`, bucket);
      }
    }

    // 主题自定义路由模板：templates/routes/<path>.tsx
    const routeBucket = [];
    directTemplates(path.join(tplDir, 'routes'), '', routeBucket);

    if (bucket.length > 0) themeEntries.set(slug, bucket);
    if (routeBucket.length > 0) themeRouteEntries.set(slug, routeBucket);
  }
}

// ── 插件自带模板 ─────────────────────────────────────────────
const pluginEntries = new Map(); // pluginSlug → [{ key, rel }]
if (fs.existsSync(PLUGINS_DIR)) {
  for (const pluginDir of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!pluginDir.isDirectory() || isResidueDir(pluginDir.name)) continue;
    const bucket = [];
    directTemplates(path.join(PLUGINS_DIR, pluginDir.name, 'templates'), '', bucket);
    if (bucket.length > 0) pluginEntries.set(pluginDir.name, bucket);
  }
}

// ── 生成文件 ─────────────────────────────────────────────────
let counter = 0;
const imports = [];
const registryBody = [];

for (const [slug, entries] of [...themeEntries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const lines = entries
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => {
      const ident = `themeTpl${counter++}`;
      imports.push(`import * as ${ident} from '${entry.rel}';`);
      return `    '${entry.key}': ${ident},`;
    });
  registryBody.push(`  '${slug}': {\n${lines.join('\n')}\n  },`);
}

const pluginImports = [];
const pluginRegistryBody = [];
for (const [slug, entries] of [...pluginEntries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const lines = entries
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => {
      const ident = `pluginTpl${counter++}`;
      pluginImports.push(`import * as ${ident} from '${entry.rel}';`);
      return `    '${entry.key}': ${ident},`;
    });
  pluginRegistryBody.push(`  '${slug}': {\n${lines.join('\n')}\n  },`);
}

const themeRouteImports = [];
const themeRouteRegistryBody = [];
for (const [slug, entries] of [...themeRouteEntries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const lines = entries
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => {
      const ident = `themeRoute${counter++}`;
      themeRouteImports.push(`import * as ${ident} from '${entry.rel}';`);
      return `    '${entry.key}': ${ident},`;
    });
  themeRouteRegistryBody.push(`  '${slug}': {\n${lines.join('\n')}\n  },`);
}

const content = `// 此文件由 scripts/generate-theme-registry.js 自动生成，请勿手动修改。
// dev/build 前会自动重新生成；新增主题或插件模板后需重启 dev 或重新 build 才能获得
// @/ 别名与 'use client' 支持（未重启时由运行时编译兜底，仅支持服务端模板）。
${[...imports, ...themeRouteImports, ...pluginImports].join('\n')}

export const themeTemplateRegistry: Record<string, Record<string, unknown>> = {
${registryBody.join('\n')}
};

export const themeRouteRegistry: Record<string, Record<string, unknown>> = {
${themeRouteRegistryBody.join('\n')}
};

export const pluginTemplateRegistry: Record<string, Record<string, unknown>> = {
${pluginRegistryBody.join('\n')}
};
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const prev = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
if (prev !== content) {
  fs.writeFileSync(OUT_FILE, content);
  const themeCount = [...themeEntries.values()].reduce((n, list) => n + list.length, 0);
  const routeCount = [...themeRouteEntries.values()].reduce((n, list) => n + list.length, 0);
  const pluginCount = [...pluginEntries.values()].reduce((n, list) => n + list.length, 0);
  console.log(`[theme-registry] ✓ 已注册主题模板 ${themeCount} 个、主题路由模板 ${routeCount} 个、插件模板 ${pluginCount} 个`);
} else {
  console.log('[theme-registry] ✓ 模板无变化');
}
