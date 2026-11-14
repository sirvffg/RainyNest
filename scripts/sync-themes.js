// scripts/sync-themes.js — 把 vendor/themes/（源码）复制到 public/themes/（运行时静态资源）
// 注意：不用 fs.cpSync —— Node 25 在中文路径下 cpSync 会原生崩溃（0xC0000409），手写递归复制
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'vendor', 'themes');
const DEST = path.join(__dirname, '..', 'public', 'themes');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

if (fs.existsSync(DEST)) {
  // 逐项删除目录内容（Windows 下直接 rmSync 整个目录容易 EPERM）
  for (const item of fs.readdirSync(DEST)) {
    try {
      fs.rmSync(path.join(DEST, item), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (err) {
      console.warn(`[sync-themes] 清理 ${item} 失败（可能被占用）:`, err.message);
    }
  }
}
fs.mkdirSync(DEST, { recursive: true });

if (fs.existsSync(SRC)) {
  for (const themeDir of fs.readdirSync(SRC)) {
    const full = path.join(SRC, themeDir);
    if (fs.statSync(full).isDirectory()) {
      copyDir(full, path.join(DEST, themeDir));
    }
  }
}

console.log('[sync-themes] ✓ Themes synced to public/themes/');
