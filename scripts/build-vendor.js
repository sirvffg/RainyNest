// scripts/build-vendor.js — esbuild 预编译 vendor/{plugins,themes} 的 .ts/.tsx
// prebuild / prestart / reload:vendor 都跑这个
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

const OPTIONS = {
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  jsx: 'automatic',
  minify: process.env.NODE_ENV === 'production',
};

function compileDir(srcDir, destDir, entryFiles) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });

  for (const item of fs.readdirSync(srcDir)) {
    const itemPath = path.join(srcDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;

    for (const entryFile of entryFiles) {
      const entry = path.join(itemPath, entryFile);
      if (!fs.existsSync(entry)) continue;

      const out = path.join(destDir, item, entryFile.replace(/\.tsx?$/, '.js'));
      fs.mkdirSync(path.dirname(out), { recursive: true });

      esbuild.buildSync({ entryPoints: [entry], outfile: out, bundle: false, ...OPTIONS });
    }
  }
}

function main() {
  const root = process.cwd();
  const compiledDir = path.join(root, '.vendor-compiled');
  if (fs.existsSync(compiledDir)) fs.rmSync(compiledDir, { recursive: true });

  // 1. 预编译插件（入口 index.ts + 可选的后台页面 admin.tsx）
  compileDir(
    path.join(root, 'vendor', 'plugins'),
    path.join(compiledDir, 'plugins'),
    ['index.ts', 'admin.tsx']
  );

  // 2. 预编译主题（入口 theme.ts）
  compileDir(
    path.join(root, 'vendor', 'themes'),
    path.join(compiledDir, 'themes'),
    ['theme.ts']
  );

  console.log('[build-vendor] ✓ Precompiled vendor/plugins + vendor/themes');
}

if (require.main === module) main();
module.exports = { compileDir };
