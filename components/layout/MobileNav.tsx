'use client';

// components/layout/MobileNav.tsx — 前台移动端导航菜单（由 Header 展开/收起）
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from './Header';

export interface MobileNavAction {
  key: string;
  label: string;
  href: string;
}

export default function MobileNav({
  open,
  menus,
  actions = [],
  onClose,
}: {
  open: boolean;
  menus: NavItem[];
  actions?: MobileNavAction[];
  onClose: () => void;
}) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <nav className="md:hidden border-t border-line bg-bg px-4 py-2 anim-scale-in">
      {menus.map((item) => (
        <Link
          key={item.url}
          href={item.url}
          onClick={onClose}
          className={`block px-3 py-2.5 rounded text-sm transition-colors duration-200 ${
            pathname === item.url ? 'text-primary bg-bg-secondary font-medium' : 'text-fg-muted'
          }`}
        >
          {item.name}
        </Link>
      ))}

      {/* 插件顶栏按钮（移动端收入菜单） */}
      {actions.length > 0 && (
        <div className="mt-1 border-t border-dashed border-line pt-1">
          {actions.map((action) => (
            <Link
              key={action.key}
              href={action.href}
              onClick={onClose}
              className="block px-3 py-2.5 rounded text-sm text-fg-muted transition-colors duration-200 hover:text-primary"
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
