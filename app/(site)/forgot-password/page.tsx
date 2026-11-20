'use client';

// app/(site)/forgot-password/page.tsx — 找回密码（邮箱验证码 + 重置密码）
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, Loader2, Lock, Mail } from 'lucide-react';

const inputBase =
  'w-full pl-10 pr-3 py-2.5 rounded border border-line bg-bg text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleSendCode() {
    if (!email.trim()) {
      setError('请先填写邮箱');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || '重置失败，请稍后重试');
      } else {
        setDone(true);
      }
    } catch {
      setError('重置失败，请稍后重试');
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm anim-scale-in">
        <div className="rounded-lg border border-line bg-bg p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" strokeWidth={1.5} />
          <h1 className="mt-3 text-lg font-bold">密码已重置</h1>
          <p className="mt-2 text-sm text-fg-muted">所有已登录设备已下线，请使用新密码重新登录。</p>
          <Link
            href="/signin"
            className="mt-6 inline-block w-full rounded bg-primary py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-primary-hover active:scale-[0.98]"
          >
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm anim-scale-in">
      <div className="rounded-lg border border-line bg-bg p-8 shadow-sm">
        <div className="text-center anim-fade-in-down">
          <KeyRound className="mx-auto h-10 w-10 text-primary" strokeWidth={1.5} />
          <h1 className="mt-3 text-xl font-bold">找回密码</h1>
          <p className="mt-1 text-sm text-fg-muted">通过邮箱验证码重置密码</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="注册邮箱"
              required
              autoComplete="email"
              className={inputBase}
            />
          </div>

          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
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
              className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded border border-line px-2.5 py-1 text-xs text-fg-muted transition-all duration-200 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending && <Loader2 className="h-3 w-3 animate-spin" />}
              {countdown > 0 ? `${countdown} 秒后重发` : '发送验证码'}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="新密码（至少 6 位）"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputBase}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="确认新密码"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputBase}
            />
          </div>

          {error && <p className="text-sm text-red-500 anim-fade-in">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-primary py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '提交中...' : '重置密码'}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-fg-muted">
        想起密码了？
        <Link href="/signin" className="ml-1 text-primary hover:underline">
          返回登录
        </Link>
      </p>
    </div>
  );
}
