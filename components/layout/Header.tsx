'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu as MenuIcon, X, CloudRain } from 'lucide-react';
import UserMenu from './UserMenu';
import MobileNav from './MobileNav';

export interface NavItem {
  name: string;
  url: string;
}

// 插件 injectHeaderAction 注入的顶栏按钮（仅渲染带 href 的项）
export interface HeaderAction {
  key: string;
  label: string;
  href?: string;
}

export default function Header({
  siteTitle,
  menus,
  showSearch,
  headerActions = [],
}: {
  siteTitle: string;
  menus: NavItem[];
  showSearch?: boolean;
  headerActions?: HeaderAction[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const actions = headerActions.filter((a) => typeof a.href === 'string' && a.href.length > 0) as {
    key: string;
    label: string;
    href: string;
  }[];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[color-mix(in_srgb,var(--color-bg)_85%,transparent)] backdrop-blur-md anim-fade-in-down">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg transition-transform duration-200 hover:scale-105 active:scale-95">
          <CloudRain className="w-6 h-6 text-primary" strokeWidth={2} />
          <span>{siteTitle}</span>
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden md:flex items-center gap-1">
          {menus.map((item) => {
            const active = pathname === item.url;
            return (
              <Link
                key={item.url}
                href={item.url}
                className={`px-3 py-1.5 rounded text-sm transition-all duration-200 active:scale-95 hover:bg-bg-secondary ${
                  active ? 'text-primary font-medium bg-bg-secondary' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          {/* 插件顶栏按钮（桌面端） */}
          {actions.length > 0 && (
            <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
          )}
          {actions.map((action) => (
            <Link
              key={action.key}
              href={action.href}
              className="px-3 py-1.5 rounded text-sm text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-95"
            >
              {action.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {showSearch !== false && (
            <Link
              href="/search"
              aria-label="搜索"
              className="p-2 rounded transition-all duration-200 active:scale-90 hover:bg-bg-secondary text-fg-muted hover:text-fg"
            >
              <Search className="w-5 h-5" />
            </Link>
          )}
          {/* 用户入口（登录 / 个人页面） */}
          <UserMenu />
          {/* 移动端菜单按钮 */}
          <button
            aria-label="菜单"
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded transition-all duration-200 active:scale-90 hover:bg-bg-secondary text-fg-muted"
          >
            {open ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 移动端导航 */}
      <MobileNav open={open} menus={menus} actions={actions} onClose={() => setOpen(false)} />
    </header>
  );
}
