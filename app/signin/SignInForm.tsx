'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { CloudRain, Lock, User } from 'lucide-react';

export default function SignInForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/console';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', { username, password, redirect: false });
      if (result?.error) {
        setError('用户名或密码错误');
        setLoading(false);
      } else {
        window.location.href = redirect;
      }
    } catch {
      setError('登录失败 请稍后重试');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-secondary">
      <div className="w-full max-w-sm anim-scale-in">
        <div className="rounded-lg border border-line bg-bg p-8 shadow-sm">
          <div className="text-center anim-fade-in-down">
            <CloudRain className="w-10 h-10 text-primary mx-auto" strokeWidth={1.5} />
            <h1 className="mt-3 text-xl font-bold">登录 RainyNest</h1>
            <p className="mt-1 text-sm text-fg-muted">进入管理后台</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                required
                autoComplete="username"
                className="w-full pl-10 pr-3 py-2.5 rounded border border-line bg-bg text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-3 py-2.5 rounded border border-line bg-bg text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && <p className="text-sm text-red-500 anim-fade-in">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-primary text-white text-sm font-medium transition-all duration-200 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-fg-muted anim-fade-in" style={{ animationDelay: '0.2s' }}>
          还没有账号？
          <Link href="/register" className="text-primary hover:underline ml-1">
            去注册
          </Link>
        </p>
      </div>
    </div>
  );
}
