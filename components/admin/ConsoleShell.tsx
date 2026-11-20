// components/admin/ConsoleShell.tsx — 后台框架：浅色侧栏（Halo 风格）+ 顶栏 + 移动端抽屉
// 侧栏：白底 / 顶部搜索（Ctrl+K 过滤菜单）/ 图标+文字菜单项（active 左竖条）/ 底部用户区

'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  BarChart3,
  ChevronDown,
  CloudRain,
  DatabaseBackup,
  ExternalLink,
  FileStack,
  FileText,
  FolderOpen,
  Images,
  LayoutDashboard,
  Link2,
  ListTree,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Paperclip,
  Palette,
  Puzzle,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ConsoleUser {
  displayName: string;
  roles: string[];
}

interface NavItem {
  href: string;
  title: string;
  icon: LucideIcon;
}

export interface PluginNavItem {
  href: string;
  title: string;
  pluginName: string;
  // 归入的侧栏分组：内置分组名或自定义新分组名；缺省进「插件」组
  group?: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: '总览',
    items: [{ href: '/console', title: '仪表盘', icon: LayoutDashboard }],
  },
  {
    label: '内容',
    items: [
      { href: '/console/posts', title: '文章', icon: FileText },
      { href: '/console/categories', title: '分类', icon: FolderOpen },
      { href: '/console/tags', title: '标签', icon: Tags },
      { href: '/console/comments', title: '评论', icon: MessageSquare },
      { href: '/console/pages', title: '页面', icon: FileStack },
      { href: '/console/moments', title: '说说', icon: Sparkles },
      { href: '/console/attachments', title: '附件', icon: Paperclip },
    ],
  },
  {
    label: '站点',
    items: [
      { href: '/console/gallery', title: '相册', icon: Images },
      { href: '/console/links', title: '友链', icon: Link2 },
      { href: '/console/system/menu', title: '菜单', icon: ListTree },
    ],
  },
  {
    label: '系统',
    items: [
      { href: '/console/system/settings', title: '设置', icon: Settings },
      { href: '/console/system/users', title: '用户', icon: Users },
      { href: '/console/system/roles', title: '角色', icon: ShieldCheck },
      { href: '/console/system/themes', title: '主题', icon: Palette },
      { href: '/console/system/plugins', title: '插件', icon: Puzzle },
    ],
  },
  {
    label: '工具',
    items: [
      { href: '/console/tools/stats', title: '统计', icon: BarChart3 },
      { href: '/console/tools/backup', title: '备份', icon: DatabaseBackup },
      { href: '/console/tools/cache', title: '缓存', icon: RefreshCw },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  administrator: '管理员',
  editor: '编辑',
  author: '作者',
  contributor: '投稿者',
  reader: '读者',
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/console') return pathname === '/console';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveTitle(pathname: string, pluginNav: PluginNavItem[]): { title: string; icon: LucideIcon } {
  let title = '控制台';
  let icon: LucideIcon = LayoutDashboard;
  let bestLen = 0;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(pathname, item.href) && item.href.length > bestLen) {
        title = item.title;
        icon = item.icon;
        bestLen = item.href.length;
      }
    }
  }
  for (const item of pluginNav) {
    if (isActive(pathname, item.href) && item.href.length > bestLen) {
      title = item.title;
      icon = Puzzle;
      bestLen = item.href.length;
    }
  }
  return { title, icon };
}

export default function ConsoleShell({
  user,
  pluginNav = [],
  children,
}: {
  user: ConsoleUser;
  pluginNav?: PluginNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [navItems, setNavItems] = useState<PluginNavItem[]>(pluginNav);
  const [filter, setFilter] = useState('');
  // 分组折叠状态（展开/收起动画为纯 CSS max-height 过渡）
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  // 收起分组时指示层不做位移动画（直接跳位）
  const [indicatorInstant, setIndicatorInstant] = useState(false);

  // 布局突变（收起分组 / 搜索过滤）时，指示层直接跳位，不做滑动动画
  function flashInstantIndicator() {
    setIndicatorInstant(true);
    window.setTimeout(() => setIndicatorInstant(false), 80);
  }

  function toggleGroup(label: string) {
    if (!collapsed[label]) flashInstantIndicator();
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  // 全侧栏共用一个激活指示层：按真实 DOM 坐标定位，跨分组切换也能连续滑动
  const updateActiveIndicator = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;

    const activeLink = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
    const groupContent = activeLink?.closest<HTMLElement>('[data-nav-group-content]');
    if (!activeLink || !groupContent || groupContent.getBoundingClientRect().height < 1) {
      setIndicatorTop(null);
      return;
    }

    // 用布局位置（offsetTop 叠加）而非 rect：避免入场动画的 transform 干扰定位
    let top = 0;
    let el: HTMLElement | null = activeLink;
    while (el && el !== nav) {
      top += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    setIndicatorTop(top);
  }, []);

  useLayoutEffect(() => {
    updateActiveIndicator();
    // 字体加载完成后行高/字宽可能微调，重新校准指示层位置
    document.fonts?.ready.then(() => updateActiveIndicator()).catch(() => {});
  }, [pathname, filter, navItems, collapsed, updateActiveIndicator]);

  // 菜单滚动时同步指示层；分组 max-height 动画结束后重新校准位置
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const onScroll = () => updateActiveIndicator();
    nav.addEventListener('scroll', onScroll, { passive: true });

    const observer = new ResizeObserver(() => updateActiveIndicator());
    observer.observe(nav);
    nav.querySelectorAll('[data-nav-group-content]').forEach((node) => observer.observe(node));

    return () => {
      nav.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [updateActiveIndicator, navItems, filter]);

  // 路由变化时收起抽屉、清空过滤、展开当前分组
  useEffect(() => {
    setDrawerOpen(false);
    setFilter('');
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((i) => isActive(pathname, i.href)),
    );
    if (activeGroup) setCollapsed((prev) => ({ ...prev, [activeGroup.label]: false }));
  }, [pathname]);

  // 插件启停后局部刷新侧栏菜单（监听全局事件，不整页刷新）
  useEffect(() => {
    const onNavChanged = () => {
      fetch('/api/console/plugin-nav', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setNavItems(Array.isArray(d?.items) ? d.items : []))
        .catch(() => {});
    };
    window.addEventListener('rainynest:plugin-nav-changed', onNavChanged);
    return () => window.removeEventListener('rainynest:plugin-nav-changed', onNavChanged);
  }, []);

  // Ctrl+K / Cmd+K 聚焦搜索框
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pageTitle = resolveTitle(pathname, navItems);
  const roleText = user.roles.map((r) => ROLE_LABELS[r] ?? r).join(' / ') || '成员';

  // 合并插件菜单：group 命中内置分组则归入，否则新建同名分组，无 group 的进「插件」组
  const navGroups = useMemo(() => {
    const arr: { label: string; items: NavItem[] }[] = NAV_GROUPS.map((g) => ({
      ...g,
      items: [...g.items],
    }));
    const fallback: NavItem[] = [];
    for (const p of navItems) {
      const entry: NavItem = { href: p.href, title: p.title, icon: Puzzle };
      const idx = p.group ? arr.findIndex((g) => g.label === p.group) : -1;
      if (idx >= 0) arr[idx].items.push(entry);
      else if (p.group) arr.push({ label: p.group, items: [entry] });
      else fallback.push(entry);
    }
    if (fallback.length > 0) arr.push({ label: '插件', items: fallback });
    return arr;
  }, [navItems]);

  // 搜索过滤菜单
  const filteredGroups = useMemo(() => {
    const kw = filter.trim().toLowerCase();
    if (!kw) return navGroups;
    return navGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.title.toLowerCase().includes(kw)) }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, filter]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ redirectTo: '/signin' });
    } catch {
      window.location.href = '/signin';
    }
  }

  return (
    <div className="console-font min-h-screen bg-bg-secondary">
      {/* 移动端遮罩 */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* 侧边栏（Halo 风格升级：光晕遮罩 + 虚线装饰 + 可折叠分组 + 玻璃用户区） */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-bg transition-transform duration-300 ease-smooth lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 顶部光晕装饰（径向遮罩渐隐） */}
        <div
          aria-hidden="true"
          className="nav-glow pointer-events-none absolute inset-x-0 top-0 h-44 [mask-image:radial-gradient(130%_100%_at_50%_0%,black,transparent)]"
        />

        {/* Logo */}
        <div className="anim-fade-in-down relative flex h-16 shrink-0 items-center gap-2.5 px-6">
          <span className="nav-logo-badge flex h-9 w-9 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <CloudRain className="h-6 w-6 text-primary drop-shadow-[0_1px_3px_color-mix(in_srgb,var(--color-primary)_38%,transparent)]" strokeWidth={1.8} />
          </span>
          <div>
            <div className="text-base font-bold leading-tight">RainyNest</div>
            <div className="text-[10px] leading-tight text-fg-muted">博客控制台</div>
          </div>
          {/* 移动端关闭按钮 */}
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭菜单"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded transition-all duration-200 hover:bg-bg-secondary active:scale-90 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 虚线装饰分隔 */}
        <div aria-hidden="true" className="mx-6 shrink-0 border-t-2 border-dashed border-line" />

        {/* 搜索（Ctrl+K，实时过滤菜单，毛玻璃底） */}
        <div className="anim-fade-in relative shrink-0 px-3 pb-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-fg-muted transition-colors duration-200" />
            <input
              ref={searchRef}
              value={filter}
              onChange={(e) => {
                flashInstantIndicator();
                setFilter(e.target.value);
              }}
              placeholder="搜索菜单"
              className="nav-search h-9 w-full rounded-lg border border-line/70 bg-bg-secondary/60 pl-9 pr-12 text-sm outline-none backdrop-blur-[10px] transition-all duration-200 placeholder:text-fg-muted/70 focus:-translate-y-px focus:border-primary focus:bg-bg focus:text-fg focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--color-primary)_22%,transparent)]"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-bg px-1.5 py-0.5 text-[10px] font-medium text-fg-muted sm:block">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* 菜单（可折叠分组：纯 CSS max-height 平滑展开/收起） */}
        <nav ref={navRef} className="relative flex-1 space-y-2.5 overflow-y-auto px-3 pb-4">
          {filteredGroups.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-fg-muted">没有匹配的菜单</p>
          ) : (
            <>
              <div
                aria-hidden="true"
                className={`nav-indicator pointer-events-none absolute left-3 right-3 z-0 h-9 overflow-hidden rounded-[14px] border border-white/90 backdrop-blur-xl ring-1 ring-white/30 after:absolute after:inset-x-3 after:top-0 after:h-px after:rounded-full after:bg-white/95 after:content-[''] ${
                  indicatorInstant
                    ? ''
                    : 'transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,1.25,.35,1)]'
                } ${indicatorTop !== null ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: `translateY(${indicatorTop ?? 0}px)` }}
              />
              {filteredGroups.map((group) => {
              const open = !collapsed[group.label];
              const hasActive = group.items.some((i) => isActive(pathname, i.href));
              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={open}
                    className={`flex w-full items-center justify-between rounded-md px-2 pb-1 pt-1.5 text-xs font-medium transition-colors duration-200 ${
                      hasActive ? 'text-primary/80' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-300 ease-smooth ${open ? '' : '-rotate-90'}`}
                    />
                  </button>
                  <div
                    data-nav-group-content
                    onTransitionEnd={updateActiveIndicator}
                    className={`overflow-hidden ${
                      open ? 'transition-[max-height,opacity] duration-300 ease-smooth' : ''
                    }`}
                    style={{ maxHeight: open ? 480 : 0, opacity: open ? 1 : 0 }}
                  >
                    <div className="relative pb-1">
                      <div className="stagger relative space-y-0.5">
                        {group.items.map((item) => {
                          const active = isActive(pathname, item.href);
                          const Icon = item.icon;
                          const pluginName = navItems.find((p) => p.href === item.href)?.pluginName;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setDrawerOpen(false)}
                              title={pluginName}
                              data-nav-active={active ? 'true' : 'false'}
                              className={`group/item relative flex h-9 items-center gap-3 rounded-[14px] border border-transparent px-3 text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px hover:border-white/55 hover:bg-white/35 hover:text-primary hover:shadow-[0_3px_10px_rgba(59,95,150,0.07)] active:translate-y-0 active:scale-[0.975] active:duration-100 ${
                                active ? 'text-primary drop-shadow-[0_1px_5px_color-mix(in_srgb,var(--color-primary)_16%,transparent)]' : 'text-fg-muted'
                              }`}
                            >
                              <Icon
                                className={`h-[18px] w-[18px] shrink-0 transition-[transform,color,filter] duration-400 ease-[cubic-bezier(.2,1.3,.35,1)] ${
                                  active
                                    ? 'scale-[1.08] text-primary drop-shadow-[0_2px_4px_color-mix(in_srgb,var(--color-primary)_22%,transparent)]'
                                    : 'text-current group-hover/item:scale-[1.12] group-hover/item:-translate-y-0.5 group-hover/item:-rotate-3'
                                }`}
                              />
                              <span className="truncate">{item.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </>
          )}
        </nav>

        {/* 底部用户区（虚线边框 + 毛玻璃卡片） */}
        <div className="relative shrink-0 px-3 pb-3">
          <div aria-hidden="true" className="mx-1 border-t-2 border-dashed border-line" />
          <div className="anim-fade-in mt-2 flex items-center gap-2.5 rounded-xl border border-dashed border-line/80 bg-bg-secondary/50 p-2 backdrop-blur-[10px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_3px_12px_color-mix(in_srgb,var(--color-primary)_14%,transparent)]">
            <span className="nav-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-tight">{user.displayName}</div>
              <div className="mt-0.5 truncate text-[11px] leading-tight text-fg-muted">{roleText}</div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              title="退出登录"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* 内容区 */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="打开菜单"
            className="inline-flex h-9 w-9 items-center justify-center rounded transition-all duration-200 hover:bg-bg-secondary active:scale-90 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 key={pageTitle.title} className="anim-fade-in-down min-w-0 text-xl font-bold">
            <span className="flex -translate-y-px items-center gap-2">
              <pageTitle.icon className="h-5 w-5 shrink-0" />
              <span className="truncate leading-none">{pageTitle.title}</span>
            </span>
          </h1>

          {/* 访问前台 */}
          <Link
            href="/"
            target="_blank"
            title="访问前台"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded transition-all duration-200 text-fg-muted hover:bg-bg-secondary hover:text-primary active:scale-90"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
