// scripts/ensure-extensions.js — 启动/构建前校验扩展安装态
// scripts/{plugins,themes} 是唯一安装目录（内置预装与上传安装共用）
// 主题静态资源由 app/themes/[slug]/[...path] 路由动态服务，无需复制到 public/
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PLUGINS_DIR = path.join(ROOT, 'scripts', 'plugins');
const THEMES_DIR = path.join(ROOT, 'scripts', 'themes');
const PUBLIC_THEMES_DIR = path.join(ROOT, 'public', 'themes');

let errors = 0;

// 1. 清扫上次运行残留的备份/待删目录（服务未启动时句柄已释放）
for (const base of [PLUGINS_DIR, THEMES_DIR]) {
  if (!fs.existsSync(base)) continue;
  for (const item of fs.readdirSync(base)) {
    if (!/(\.bak-\d+|\.deleted-\d+)$/.test(item)) continue;
    try {
      fs.rmSync(path.join(base, item), { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      console.log(`[ensure-extensions] 已清扫残留: ${item}`);
    } catch (err) {
      console.warn(`[ensure-extensions] 残留目录清扫失败（下次启动重试）: ${item}`, err.message);
    }
  }
}

// 2. 移除废弃的 public/themes 静态副本（已改为路由动态服务）
if (fs.existsSync(PUBLIC_THEMES_DIR)) {
  try {
    fs.rmSync(PUBLIC_THEMES_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch (err) {
    console.warn('[ensure-extensions] 清理废弃 public/themes 失败（下次启动重试）:', err.message);
  }
}

// 3. 校验插件清单
if (fs.existsSync(PLUGINS_DIR)) {
  for (const dir of fs.readdirSync(PLUGINS_DIR)) {
    if (/(\.bak-\d+|\.deleted-\d+)$/.test(dir)) continue; // 安装器备份/待删目录
    const full = path.join(PLUGINS_DIR, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    const jsonPath = path.join(full, 'plugin.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn(`[ensure-extensions] ⚠ 插件 ${dir} 缺少 plugin.json（跳过）`);
      continue;
    }
    try {
      const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const entry = (meta.entry || 'index.js').replace(/\.tsx?$/, '.js');
      if (!fs.existsSync(path.join(full, entry))) {
        console.warn(`[ensure-extensions] ⚠ 插件 ${dir} 入口缺失: ${entry}`);
        errors++;
      }
    } catch (err) {
      console.warn(`[ensure-extensions] ⚠ 插件 ${dir} plugin.json 解析失败:`, err.message);
      errors++;
    }
  }
} else {
  console.warn('[ensure-extensions] ⚠ scripts/plugins 不存在（无插件安装）');
}

// 4. 校验主题清单
if (fs.existsSync(THEMES_DIR)) {
  for (const dir of fs.readdirSync(THEMES_DIR)) {
    const full = path.join(THEMES_DIR, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    if (/(\.bak-\d+|\.deleted-\d+)$/.test(dir)) continue; // 安装器备份/待删目录
    const jsonPath = path.join(full, 'theme.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn(`[ensure-extensions] ⚠ 主题 ${dir} 缺少 theme.json（跳过）`);
      continue;
    }
  }
} else {
  console.warn('[ensure-extensions] ⚠ scripts/themes 不存在（无主题安装）');
}

if (errors > 0) {
  console.warn(`[ensure-extensions] 完成，${errors} 个问题需要处理`);
} else {
  console.log('[ensure-extensions] ✓ 扩展安装态就绪');
}
