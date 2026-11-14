'use client';

// components/layout/UserMenu.tsx — Header 右侧用户入口（未登录显示登录按钮 已登录显示下拉菜单）
import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { CircleUserRound, LogOut, LayoutDashboard, UserRound } from 'lucide-react';

interface SessionUser {
  id?: string;
  name?: string | null;
  username?: string;
  roles?: string[];
  permissions?: string[];
}

export default function UserMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(async (res) => {
        const data = await res.json();
        setUser(data?.user && data.user.id ? (data.user as SessionUser) : null);
      })
      .catch(() => setReady(true))
      .finally(() => setReady(true));

    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!ready) {
    return <div className="w-8 h-8 rounded-full skeleton" aria-hidden />;
  }

  // 未登录：登录按钮
  if (!user) {
    return (
      <Link
        href="/signin"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-primary text-white transition-all duration-200 hover:bg-primary-hover active:scale-95"
      >
        <UserRound className="w-4 h-4" />
        <span className="hidden sm:inline">登录</span>
      </Link>
    );
  }

  const canConsole = user.permissions?.includes('*') || user.permissions?.includes('console:login');

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="用户菜单"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 p-1 rounded-full transition-all duration-200 active:scale-90 hover:bg-bg-secondary"
      >
        <CircleUserRound className="w-6 h-6 text-primary" strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-line bg-bg shadow-lg py-1.5 z-50 anim-scale-in origin-top-right">
          <div className="px-3 py-1.5 border-b border-line">
            <p className="text-sm font-medium truncate">{user.name || user.username}</p>
            <p className="text-xs text-fg-muted truncate">@{user.username}</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-fg transition-colors duration-150 hover:bg-bg-secondary active:scale-[0.98]"
          >
            <CircleUserRound className="w-4 h-4 text-fg-muted" />
            个人页面
          </Link>
          {canConsole && (
            <Link
              href="/console"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-fg transition-colors duration-150 hover:bg-bg-secondary active:scale-[0.98]"
            >
              <LayoutDashboard className="w-4 h-4 text-fg-muted" />
              管理后台
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 transition-colors duration-150 hover:bg-bg-secondary active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
