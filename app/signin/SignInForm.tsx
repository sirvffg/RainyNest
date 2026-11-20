'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { CloudRain, KeyRound, Loader2, Lock, Mail, User } from 'lucide-react';

type LoginMode = 'password' | 'code';

/** 根据 NextAuth 返回的错误码显示中文提示 */
function resolveError(code?: string) {
  switch (code) {
    case 'LDAP_NOT_REGISTERED':
      return '该 LDAP 账号尚未绑定本地账号，请先注册本地账号';
    case 'ACCOUNT_DISABLED':
      return '账号已被禁用，无法登录';
    case 'ACCOUNT_LOCKED':
      return '账号已被锁定，请稍后再试';
    case 'CODE_INVALID':
      return '验证码错误或已过期';
    default:
      return '用户名或密码错误';
  }
}

const inputBase =
  'w-full pl-10 pr-3 py-2.5 rounded border border-line bg-bg text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function SignInForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/console';

  const [mode, setMode] = useState<LoginMode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 发送验证码后的 60 秒倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 切换登录方式时清空错误提示
  function switchMode(next: LoginMode) {
    setMode(next);
    setError('');
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', { username, password, redirect: false });
      if (result?.error) {
        setError(resolveError(result.code));
        setLoading(false);
      } else {
        window.location.href = redirect;
      }
    } catch {
      setError('登录失败 请稍后重试');
      setLoading(false);
    }
  }

  async function handleSendCode() {
    if (!email.trim()) {
      setError('请先填写邮箱');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || '验证码发送失败，请稍后重试');
      } else {
        setCountdown(60);
      }
    } catch {
      setError('验证码发送失败，请稍后重试');
    }
    setSending(false);
  }

  async function handleCodeLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('email-code', { email: email.trim(), code: code.trim(), redirect: false });
      if (result?.error) {
        setError(resolveError(result.code));
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

          {/* 登录方式切换 */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded border border-line p-1">
            <button
              type="button"
              onClick={() => switchMode('password')}
              className={`rounded px-3 py-1.5 text-sm transition-all duration-200 ${
                mode === 'password' ? 'bg-primary text-white' : 'text-fg-muted hover:text-fg'
              }`}
            >
              密码登录
            </button>
            <button
              type="button"
              onClick={() => switchMode('code')}
              className={`rounded px-3 py-1.5 text-sm transition-all duration-200 ${
                mode === 'code' ? 'bg-primary text-white' : 'text-fg-muted hover:text-fg'
              }`}
            >
              邮箱验证码
            </button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="用户名或邮箱"
                  required
                  autoComplete="username"
                  className={inputBase}
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
                  className={inputBase}
                />
              </div>

              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  忘记密码？
                </Link>
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
          ) : (
            <form onSubmit={handleCodeLogin} className="mt-6 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  required
                  autoComplete="email"
                  className={inputBase}
                />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 位验证码"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={`${inputBase} pr-28`}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending || countdown > 0}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded border border-line px-2.5 py-1 text-xs text-fg-muted transition-all duration-200 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {countdown > 0 ? `${countdown} 秒后重发` : '发送验证码'}
                </button>
              </div>

              {error && <p className="text-sm text-red-500 anim-fade-in">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded bg-primary text-white text-sm font-medium transition-all duration-200 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          )}
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
