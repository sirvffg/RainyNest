// prisma/seed.ts — 种子数据（内置角色 + ~50 权限 + 管理员 + 默认主题 + 示例内容）
// 运行：npm run db:seed
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

// ═══════════════ 权限清单（资源:动作）═══════════════
const PERMISSIONS: { name: string; displayName: string; group: string }[] = [
  // 内容
  { name: 'post:list', displayName: '文章列表', group: '内容' },
  { name: 'post:get', displayName: '查看文章', group: '内容' },
  { name: 'post:create', displayName: '创建文章', group: '内容' },
  { name: 'post:update', displayName: '更新文章', group: '内容' },
  { name: 'post:delete', displayName: '删除文章', group: '内容' },
  { name: 'post:publish', displayName: '发布文章', group: '内容' },
  { name: 'post:unpublish', displayName: '下架文章', group: '内容' },
  { name: 'page:list', displayName: '页面列表', group: '内容' },
  { name: 'page:get', displayName: '查看页面', group: '内容' },
  { name: 'page:create', displayName: '创建页面', group: '内容' },
  { name: 'page:update', displayName: '更新页面', group: '内容' },
  { name: 'page:delete', displayName: '删除页面', group: '内容' },
  { name: 'category:list', displayName: '分类列表', group: '内容' },
  { name: 'category:get', displayName: '查看分类', group: '内容' },
  { name: 'category:create', displayName: '创建分类', group: '内容' },
  { name: 'category:update', displayName: '更新分类', group: '内容' },
  { name: 'category:delete', displayName: '删除分类', group: '内容' },
  { name: 'tag:list', displayName: '标签列表', group: '内容' },
  { name: 'tag:get', displayName: '查看标签', group: '内容' },
  { name: 'tag:create', displayName: '创建标签', group: '内容' },
  { name: 'tag:update', displayName: '更新标签', group: '内容' },
  { name: 'tag:delete', displayName: '删除标签', group: '内容' },
  { name: 'moment:list', displayName: '说说列表', group: '内容' },
  { name: 'moment:create', displayName: '发布说说', group: '内容' },
  { name: 'moment:update', displayName: '更新说说', group: '内容' },
  { name: 'moment:delete', displayName: '删除说说', group: '内容' },
  { name: 'gallery:list', displayName: '相册列表', group: '内容' },
  { name: 'gallery:create', displayName: '创建相册', group: '内容' },
  { name: 'gallery:update', displayName: '更新相册', group: '内容' },
  { name: 'gallery:delete', displayName: '删除相册', group: '内容' },
  { name: 'link:list', displayName: '友链列表', group: '内容' },
  { name: 'link:create', displayName: '创建友链', group: '内容' },
  { name: 'link:update', displayName: '更新友链', group: '内容' },
  { name: 'link:delete', displayName: '删除友链', group: '内容' },
  { name: 'comment:list', displayName: '评论列表', group: '内容' },
  { name: 'comment:get', displayName: '查看评论', group: '内容' },
  { name: 'comment:approve', displayName: '通过评论', group: '内容' },
  { name: 'comment:reject', displayName: '拒绝评论', group: '内容' },
  { name: 'comment:delete', displayName: '删除评论', group: '内容' },
  { name: 'photo:upload', displayName: '上传图片', group: '内容' },
  { name: 'photo:delete', displayName: '删除图片', group: '内容' },
  { name: 'menu:list', displayName: '菜单列表', group: '内容' },
  { name: 'menu:create', displayName: '创建菜单', group: '内容' },
  { name: 'menu:update', displayName: '更新菜单', group: '内容' },
  { name: 'menu:delete', displayName: '删除菜单', group: '内容' },
  // 用户系统
  { name: 'user:list', displayName: '用户列表', group: '用户' },
  { name: 'user:create', displayName: '创建用户', group: '用户' },
  { name: 'user:update', displayName: '更新用户', group: '用户' },
  { name: 'user:delete', displayName: '删除用户', group: '用户' },
  { name: 'user:reset-password', displayName: '重置密码', group: '用户' },
  { name: 'user:assign-role', displayName: '分配角色', group: '用户' },
  { name: 'role:list', displayName: '角色列表', group: '用户' },
  { name: 'role:create', displayName: '创建角色', group: '用户' },
  { name: 'role:update', displayName: '更新角色', group: '用户' },
  { name: 'role:delete', displayName: '删除角色', group: '用户' },
  { name: 'role:assign-permission', displayName: '分配权限', group: '用户' },
  // 系统
  { name: 'site:config', displayName: '站点配置', group: '系统' },
  { name: 'seo:config', displayName: 'SEO 配置', group: '系统' },
  { name: 'smtp:config', displayName: 'SMTP 配置', group: '系统' },
  { name: 'menu:config', displayName: '导航配置', group: '系统' },
  { name: 'theme:activate', displayName: '激活主题', group: '系统' },
  // 插件/主题
  { name: 'plugin:list', displayName: '插件列表', group: '扩展' },
  { name: 'plugin:install', displayName: '安装插件', group: '扩展' },
  { name: 'plugin:uninstall', displayName: '卸载插件', group: '扩展' },
  { name: 'plugin:activate', displayName: '启用插件', group: '扩展' },
  { name: 'plugin:deactivate', displayName: '禁用插件', group: '扩展' },
  { name: 'plugin:config', displayName: '插件配置', group: '扩展' },
  { name: 'theme:list', displayName: '主题列表', group: '扩展' },
  { name: 'theme:install', displayName: '安装主题', group: '扩展' },
  { name: 'theme:uninstall', displayName: '卸载主题', group: '扩展' },
  { name: 'theme:preview', displayName: '预览主题', group: '扩展' },
  { name: 'theme:config', displayName: '主题配置', group: '扩展' },
  // 工具
  { name: 'analytics:view', displayName: '查看统计', group: '工具' },
  { name: 'analytics:export', displayName: '导出统计', group: '工具' },
  { name: 'backup:create', displayName: '创建备份', group: '工具' },
  { name: 'backup:restore', displayName: '恢复备份', group: '工具' },
  // 控制台
  { name: 'console:login', displayName: '访问后台', group: '控制台' },
  { name: 'uc:login', displayName: '访问个人中心', group: '控制台' },
];

// ═══════════════ 内置角色权限矩阵 ═══════════════
const ROLE_PERMISSIONS: Record<string, string[]> = {
  editor: [
    'post:list', 'post:get', 'post:create', 'post:update', 'post:delete', 'post:publish', 'post:unpublish',
    'page:list', 'page:get', 'page:create', 'page:update', 'page:delete',
    'category:list', 'category:get', 'category:create', 'category:update', 'category:delete',
    'tag:list', 'tag:get', 'tag:create', 'tag:update', 'tag:delete',
    'moment:list', 'moment:create', 'moment:update', 'moment:delete',
    'gallery:list', 'gallery:create', 'gallery:update', 'gallery:delete',
    'link:list', 'link:create', 'link:update', 'link:delete',
    'comment:list', 'comment:get', 'comment:approve', 'comment:reject', 'comment:delete',
    'photo:upload', 'photo:delete', 'menu:list', 'menu:update',
    'analytics:view',
    'console:login', 'uc:login',
  ],
  author: [
    'post:list', 'post:get', 'post:create', 'post:update',
    'comment:list', 'comment:get',
    'photo:upload',
    'console:login', 'uc:login',
  ],
  viewer: ['uc:login'],
};

async function main() {
  console.log('[Seed] 开始写入种子数据...');

  // 1. 权限（upsert 幂等）
  for (const perm of PERMISSIONS) {
    await db.permission.upsert({ where: { name: perm.name }, update: {}, create: perm });
  }
  console.log(`[Seed] ✓ ${PERMISSIONS.length} 个权限`);

  // 2. 内置角色
  const roles = [
    { name: 'administrator', displayName: '超级管理员', builtIn: true, forbidConsole: false, description: '拥有所有权限' },
    { name: 'editor', displayName: '编辑', builtIn: true, forbidConsole: false, description: '内容管理' },
    { name: 'author', displayName: '作者', builtIn: true, forbidConsole: false, description: '只能管理自己的内容' },
    { name: 'viewer', displayName: '访客用户', builtIn: true, forbidConsole: true, description: '注册用户默认角色' },
  ];
  const roleMap = new Map<string, string>();
  for (const role of roles) {
    const r = await db.role.upsert({ where: { name: role.name }, update: {}, create: role });
    roleMap.set(role.name, r.id);
  }
  console.log('[Seed] ✓ 4 个内置角色');

  // 3. 角色权限绑定
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName)!;
    const perms = await db.permission.findMany({ where: { name: { in: permNames } } });
    for (const perm of perms) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }
  }
  console.log('[Seed] ✓ 角色权限绑定');

  // 4. 管理员账号
  const adminRole = await db.role.findUnique({ where: { name: 'administrator' } });
  const admin = await db.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      displayName: '管理员',
      email: 'admin@rainynest.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      bio: 'RainyNest 创始人',
    },
  });
  if (adminRole) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  }
  console.log('[Seed] ✓ 管理员账号 admin / admin123');

  // 5. 站点设置
  await db.siteSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  console.log('[Seed] ✓ 站点设置');

  // 6. 默认主题（激活）
  await db.theme.upsert({
    where: { slug: 'default' },
    update: { isActive: true },
    create: {
      slug: 'default',
      name: '默认主题',
      version: '1.0.0',
      description: 'RainyNest 预装的默认主题，白底蓝调极简风',
      author: 'RainyNest Team',
      isActive: true,
    },
  });
  // 确保其他主题未激活
  await db.theme.updateMany({ where: { slug: { not: 'default' } }, data: { isActive: false } });
  console.log('[Seed] ✓ 默认主题（已激活）');

  // 7. 预装插件记录（isActive 与预装标记一致：核心插件启用，增强插件由后台手动启用）
  const plugins = [
    { slug: 'default-seo', name: 'SEO 助手', version: '1.0.0', description: '自动生成摘要 + OpenGraph/Twitter 元数据增强 + 站点验证标签', isActive: true },
    { slug: 'code-highlight', name: '代码高亮增强', version: '1.0.0', description: '高亮行区间语法转换 + Expressive Code 主题微调', isActive: true },
    { slug: 'rss-feed', name: 'RSS 订阅', version: '1.0.0', description: 'RSS/Atom 双格式输出', isActive: true },
    { slug: 'page-views', name: '页面浏览量', version: '1.0.0', description: '按路径统计 PV，独立 SQLite 存储', isActive: true },
    { slug: 'reading-time', name: '阅读时间', version: '1.0.0', description: '文章阅读时间显示', isActive: true },
    { slug: 'sitemap-enhance', name: 'Sitemap 增强', version: '1.0.0', description: '完整 sitemap.xml（文章/分类/标签/相册）', isActive: false },
    { slug: 'comment-filter', name: '评论过滤', version: '1.0.0', description: '垃圾评论自动审核（关键词/IP 黑名单）', isActive: false },
    { slug: 'related-posts', name: '相关文章', version: '1.0.0', description: '按共享标签推荐相关文章', isActive: false },
  ];
  for (const p of plugins) {
    await db.plugin.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }
  console.log('[Seed] ✓ 预装插件记录');

  // 8. 示例内容（仅首次为空时创建）
  const postCount = await db.post.count();
  if (postCount === 0) {
    const cat = await db.category.upsert({
      where: { slug: 'tech' },
      update: {},
      create: { name: '技术', slug: 'tech', description: '技术文章' },
    });
    const tag1 = await db.tag.upsert({ where: { slug: 'hello' }, update: {}, create: { name: '开箱', slug: 'hello' } });
    const tag2 = await db.tag.upsert({ where: { slug: 'nextjs' }, update: {}, create: { name: 'Next.js', slug: 'nextjs' } });

    await db.post.create({
      data: {
        authorId: admin.id,
        title: 'RainyNest 安装成功',
        slug: 'rainynest-hello-world',
        summary: '恭喜你成功部署 RainyNest 博客系统，这篇示例文章展示了 Markdown 渲染能力。',
        content: [
          '# RainyNest 安装成功',
          '',
          '恭喜你成功部署 **RainyNest** 博客系统。',
          '',
          '## Markdown 能力',
          '',
          '- GFM 表格 / 删除线 / 任务列表',
          '- 代码高亮（Expressive Code）',
          '- 数学公式：$E = mc^2$',
          '',
          '```typescript',
          'const nest = { name: "RainyNest", plugins: true, themes: true };',
          'console.log(`Hello, ${nest.name}!`);',
          '```',
          '',
          '## 下一步',
          '',
          '1. 登录后台 `/console`（admin / admin123）',
          '2. 修改站点设置',
          '3. 写下第一篇文章',
        ].join('\n'),
        status: 'PUBLISHED',
        publishedAt: new Date(),
        words: 120,
        categoryId: cat.id,
        tags: { create: [{ tagId: tag1.id }, { tagId: tag2.id }] },
      },
    });

    await db.moment.create({
      data: {
        userId: admin.id,
        content: 'RainyNest 已成功部署 🎉 今天是个好日子。',
        status: 'PUBLISHED',
      },
    });

    const menus = [
      { name: '首页', url: '/', order: 0 },
      { name: '博客', url: '/blog', order: 1 },
      { name: '说说', url: '/moments', order: 2 },
      { name: '友链', url: '/links', order: 3 },
      { name: '相册', url: '/gallery', order: 4 },
      { name: '归档', url: '/archive', order: 5 },
      { name: '标签', url: '/tags', order: 6 },
    ];
    for (const m of menus) {
      await db.menu.create({ data: m });
    }

    console.log('[Seed] ✓ 示例文章 / 说说 / 菜单');
  }

  console.log('[Seed] 全部完成');
}

main()
  .catch((e) => {
    console.error('[Seed] ✗ 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
