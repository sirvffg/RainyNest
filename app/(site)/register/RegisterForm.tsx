'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { CloudRain, Lock, User, Mail, AtSign } from 'lucide-react';

const inputCls =
  'w-full pl-10 pr-3 py-2.5 rounded border border-line bg-bg text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          displayName: form.displayName || undefined,
          password: form.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '注册失败 请稍后重试');
        setLoading(false);
        return;
      }

      // 注册成功自动登录
      await signIn('credentials', {
        username: form.username,
        password: form.password,
        redirect: false,
      });
      router.push('/');
      router.refresh();
    } catch {
      setError('注册失败 请稍后重试');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm anim-scale-in">
        <div className="rounded-lg border border-line bg-bg p-8 shadow-sm">
          <div className="text-center anim-fade-in-down">
            <CloudRain className="w-10 h-10 text-primary mx-auto" strokeWidth={1.5} />
            <h1 className="mt-3 text-xl font-bold">注册账号</h1>
            <p className="mt-1 text-sm text-fg-muted">加入本站 畅所欲言</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="text"
                value={form.username}
                onChange={set('username')}
                placeholder="用户名（字母 数字 下划线）"
                required
                autoComplete="username"
                className={inputCls}
              />
            </div>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="text"
                value={form.displayName}
                onChange={set('displayName')}
                placeholder="昵称（选填 默认与用户名相同）"
                maxLength={30}
                className={inputCls}
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="邮箱"
                required
                autoComplete="email"
                className={inputCls}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="密码（至少 6 位）"
                required
                minLength={6}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                placeholder="确认密码"
                required
                minLength={6}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>

            {error && <p className="text-sm text-red-500 anim-fade-in">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-primary text-white text-sm font-medium transition-all duration-200 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '注册中...' : '注 册'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-fg-muted anim-fade-in" style={{ animationDelay: '0.2s' }}>
          已有账号？
          <Link href="/signin" className="text-primary hover:underline ml-1">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
