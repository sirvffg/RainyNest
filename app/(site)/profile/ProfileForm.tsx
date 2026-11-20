'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Link2, FileText, KeyRound, Save, CircleUserRound, MonitorSmartphone, LogOut } from 'lucide-react';

interface ProfileData {
  username: string;
  displayName: string;
  email: string;
  bio: string | null;
  avatar: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
}

interface SessionItem {
  id: string;
  device: string | null;
  ip: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

const inputCls =
  'w-full pl-10 pr-3 py-2.5 rounded border border-line bg-bg text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('zh-CN', { hour12: false });
}

export default function ProfileForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [info, setInfo] = useState({ displayName: '', email: '', bio: '', avatar: '' });
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [infoSaving, setInfoSaving] = useState(false);

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // 登录设备
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [sessionMsg, setSessionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProfile(data);
        setInfo({
          displayName: data.displayName || '',
          email: data.email || '',
          bio: data.bio || '',
          avatar: data.avatar || '',
        });
        setLoading(false);
      })
      .catch(() => {
        window.location.href = '/signin?redirect=/profile';
      });
  }, []);

  // 加载登录设备列表
  useEffect(() => {
    fetch('/api/profile/sessions')
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => setSessions(Array.isArray(data?.list) ? data.list : []))
      .catch(() => setSessions([]));
  }, []);

  async function revokeSession(session: SessionItem) {
    if (revoking) return;
    setRevoking(session.id);
    setSessionMsg(null);
    try {
      const res = await fetch('/api/profile/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || '下线失败');
      setSessions((list) => (list ? list.filter((item) => item.id !== session.id) : list));
      setSessionMsg({ ok: true, text: '该设备已下线' });
    } catch (err) {
      setSessionMsg({ ok: false, text: err instanceof Error ? err.message : '下线失败 请稍后重试' });
    }
    setRevoking(null);
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoMsg(null);
    setInfoSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: info.displayName,
          email: info.email,
          bio: info.bio || null,
          avatar: info.avatar || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInfoMsg({ ok: true, text: '资料已保存' });
        router.refresh();
      } else {
        setInfoMsg({ ok: false, text: data.error || '保存失败' });
      }
    } catch {
      setInfoMsg({ ok: false, text: '保存失败 请稍后重试' });
    }
    setInfoSaving(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ ok: false, text: '两次输入的新密码不一致' });
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdMsg({ ok: true, text: '密码已修改' });
        setPwd({ current: '', next: '', confirm: '' });
      } else {
        setPwdMsg({ ok: false, text: data.error || '修改失败' });
      }
    } catch {
      setPwdMsg({ ok: false, text: '修改失败 请稍后重试' });
    }
    setPwdSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4 anim-fade-in">
        <div className="skeleton h-24" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* 用户信息头 */}
      <div className="rounded-lg border border-line bg-bg p-6 flex items-center gap-4 shadow-sm anim-fade-in-up">
        {profile?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar} alt="头像" className="w-14 h-14 rounded-full object-cover border border-line" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CircleUserRound className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{profile?.displayName}</h1>
          <p className="text-sm text-fg-muted truncate">@{profile?.username}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {profile?.roles.map((r) => (
              <span key={r} className="rounded-full bg-primary/10 text-primary text-[11px] px-2 py-0.5">
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-fg-muted text-center anim-fade-in">
        注册于 {fmtDate(profile?.createdAt || null)} · 最近登录 {fmtDate(profile?.lastLoginAt || null)}
      </p>

      {/* 资料编辑 */}
      <form
        onSubmit={saveInfo}
        className="rounded-lg border border-line bg-bg p-6 space-y-4 shadow-sm anim-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <h2 className="font-semibold flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-primary" /> 基本信息
        </h2>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            value={info.displayName}
            onChange={(e) => setInfo({ ...info, displayName: e.target.value })}
            placeholder="昵称"
            required
            maxLength={30}
            className={inputCls}
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            type="email"
            value={info.email}
            onChange={(e) => setInfo({ ...info, email: e.target.value })}
            placeholder="邮箱"
            required
            className={inputCls}
          />
        </div>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            value={info.avatar}
            onChange={(e) => setInfo({ ...info, avatar: e.target.value })}
            placeholder="头像图片链接（选填）"
            className={inputCls}
          />
        </div>
        <div className="relative">
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <textarea
            value={info.bio}
            onChange={(e) => setInfo({ ...info, bio: e.target.value })}
            placeholder="个人简介（选填 最多 200 字）"
            rows={3}
            maxLength={200}
            className="w-full pl-10 pr-3 py-2.5 rounded border border-line bg-bg text-sm outline-none resize-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {infoMsg && (
          <p className={`text-sm anim-fade-in ${infoMsg.ok ? 'text-primary' : 'text-red-500'}`}>{infoMsg.text}</p>
        )}

        <button
          type="submit"
          disabled={infoSaving}
          className="w-full py-2.5 rounded bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {infoSaving ? '保存中...' : '保存资料'}
        </button>
      </form>

      {/* 修改密码 */}
      <form
        onSubmit={savePassword}
        className="rounded-lg border border-line bg-bg p-6 space-y-4 shadow-sm anim-fade-in-up"
        style={{ animationDelay: '0.2s' }}
      >
        <h2 className="font-semibold flex items-center gap-2 text-sm">
          <KeyRound className="w-4 h-4 text-primary" /> 修改密码
        </h2>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            type="password"
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
            placeholder="当前密码"
            required
            autoComplete="current-password"
            className={inputCls}
          />
        </div>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            type="password"
            value={pwd.next}
            onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
            placeholder="新密码（至少 6 位）"
            required
            minLength={6}
            autoComplete="new-password"
            className={inputCls}
          />
        </div>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            type="password"
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            placeholder="确认新密码"
            required
            minLength={6}
            autoComplete="new-password"
            className={inputCls}
          />
        </div>

        {pwdMsg && (
          <p className={`text-sm anim-fade-in ${pwdMsg.ok ? 'text-primary' : 'text-red-500'}`}>{pwdMsg.text}</p>
        )}

        <button
          type="submit"
          disabled={pwdSaving}
          className="w-full py-2.5 rounded border border-line bg-bg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:bg-bg-secondary active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pwdSaving ? '提交中...' : '确认修改'}
        </button>
      </form>

      {/* 登录设备 */}
      <div
        className="rounded-lg border border-line bg-bg p-6 space-y-4 shadow-sm anim-fade-in-up"
        style={{ animationDelay: '0.3s' }}
      >
        <h2 className="font-semibold flex items-center gap-2 text-sm">
          <MonitorSmartphone className="w-4 h-4 text-primary" /> 登录设备
        </h2>

        {sessions === null ? (
          <div className="space-y-2">
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-fg-muted">暂无登录设备记录</p>
        ) : (
          <div className="divide-y divide-line">
            {sessions.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.device || '未知设备'}</span>
                    {item.current && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">当前设备</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {item.ip || '未知 IP'} · 最近活跃 {fmtDate(item.lastActiveAt)}
                  </p>
                  {item.userAgent && (
                    <p className="mt-0.5 truncate text-[11px] text-fg-muted/70" title={item.userAgent}>
                      {item.userAgent}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={item.current || revoking !== null}
                  onClick={() => revokeSession(item)}
                  title={item.current ? '当前设备不可下线' : '下线该设备'}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-line px-2.5 py-1.5 text-xs text-fg-muted transition-all duration-200 hover:border-red-300 hover:text-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {revoking === item.id ? '下线中' : '下线'}
                </button>
              </div>
            ))}
          </div>
        )}

        {sessionMsg && (
          <p className={`text-sm anim-fade-in ${sessionMsg.ok ? 'text-primary' : 'text-red-500'}`}>{sessionMsg.text}</p>
        )}
      </div>
    </div>
  );
}
