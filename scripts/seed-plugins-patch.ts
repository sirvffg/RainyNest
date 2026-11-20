// scripts/seed-plugins-patch.ts — 一次性增量补种：8 个 Plugin 记录 + 缺失的菜单项
// 用途：对现有数据库增量补种（不要整体重跑 prisma/seed.ts）
// 运行：npx tsx scripts/seed-plugins-patch.ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// 预装插件清单（isActive 与预装表一致）
const PLUGINS = [
  { slug: 'default-seo', name: 'SEO 助手', version: '1.0.0', description: '自动生成摘要 + OpenGraph/Twitter 元数据增强 + 站点验证标签', isActive: true },
  { slug: 'code-highlight', name: '代码高亮增强', version: '1.0.0', description: '高亮行区间语法转换 + Expressive Code 主题微调', isActive: true },
  { slug: 'rss-feed', name: 'RSS 订阅', version: '1.0.0', description: 'RSS/Atom 双格式输出', isActive: true },
  { slug: 'reading-time', name: '阅读时间', version: '1.0.0', description: '文章阅读时间显示', isActive: true },
  { slug: 'sitemap-enhance', name: 'Sitemap 增强', version: '1.0.0', description: '完整 sitemap.xml（文章/分类/标签/相册）', isActive: false },
  { slug: 'comment-filter', name: '评论过滤', version: '1.0.0', description: '垃圾评论自动审核（关键词/IP 黑名单）', isActive: false },
  { slug: 'related-posts', name: '相关文章', version: '1.0.0', description: '按共享标签推荐相关文章', isActive: false },
];

// 需要补齐的菜单项
const MENUS = [
  { name: '相册', url: '/gallery' },
  { name: '归档', url: '/archive' },
  { name: '标签', url: '/tags' },
];

async function main() {
  console.log('[Seed-Patch] 开始增量补种...');

  // 1. Plugin 记录：已有记录不覆盖（保留后台修改过的状态），缺失的按预装表 create
  let created = 0;
  for (const p of PLUGINS) {
    const existing = await db.plugin.findUnique({ where: { slug: p.slug } });
    if (existing) {
      console.log(`[Seed-Patch] Plugin 已存在，跳过: ${p.slug} (isActive=${existing.isActive})`);
      continue;
    }
    await db.plugin.create({ data: p });
    created += 1;
    console.log(`[Seed-Patch] ✓ Plugin 已补种: ${p.slug} (isActive=${p.isActive})`);
  }
  console.log(`[Seed-Patch] 插件补种完成，新建 ${created} 条`);

  // 2. 菜单补齐：按 url 判断，缺失的按现有最大 order + 1 递增插入
  const allMenus = await db.menu.findMany({ select: { id: true, name: true, url: true, order: true } });
  const existingUrls = new Set(allMenus.map((m) => m.url));
  let maxOrder = allMenus.reduce((max, m) => Math.max(max, m.order), 0);

  let menusCreated = 0;
  for (const m of MENUS) {
    if (existingUrls.has(m.url)) {
      console.log(`[Seed-Patch] Menu 已存在，跳过: ${m.url}`);
      continue;
    }
    maxOrder += 1;
    await db.menu.create({ data: { name: m.name, url: m.url, order: maxOrder } });
    menusCreated += 1;
    console.log(`[Seed-Patch] ✓ Menu 已补齐: ${m.name} ${m.url} (order=${maxOrder})`);
  }
  console.log(`[Seed-Patch] 菜单补齐完成，新建 ${menusCreated} 条`);

  console.log('[Seed-Patch] 全部完成');
}

main()
  .catch((e) => {
    console.error('[Seed-Patch] ✗ 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
