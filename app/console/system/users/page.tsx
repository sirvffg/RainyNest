'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Pencil, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';
import Toggle from '@/components/admin/Toggle';

interface RoleInfo {
  id: string;
  name: string;
  displayName: string;
}

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: string;
  // API 返回的是关联表行 { userId, roleId, role }（Prisma 隐式连接表无独立 id）
  roles: { userId: string; roleId: string; role: RoleInfo }[];
  createdAt?: string;
  lastLoginAt?: string | null;
}

const inputClass =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

function fmtDateTime(s?: string | null) {
  if (!s) return '从未登录';
  const d = new Date(s);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status: string) {
  if (status === 'ENABLED') return { text: '正常', cls: 'bg-emerald-50 text-emerald-600' };
  if (status === 'LOCKED') return { text: '已锁定', cls: 'bg-red-50 text-red-500' };
  return { text: '已禁用', cls: 'bg-bg-secondary text-fg-muted' };
}

export default function UsersPage() {
  return (
    <ToastProvider>
      <UsersContent />
    </ToastProvider>
  );
}

function UsersContent() {
  const toast = useToast();
  const [list, setList] = useState<UserItem[]>([]);
  const [allRoles, setAllRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    enabled: true,
    roleIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/console/users');
      const data = await res.json();
      setList(data.list ?? []);
      // 全部角色（含尚未分配给任何用户的内置角色）
      if (Array.isArray(data.roles)) setAllRoles(data.roles);
    } catch {
      toast('加载用户列表失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  /** 角色选项 优先用角色表 全量兜底从用户身上收集 */
  const roleOptions = useMemo(() => {
    if (allRoles.length > 0) return allRoles;
    const map = new Map<string, RoleInfo>();
    list.forEach((u) => (u.roles ?? []).forEach((r) => map.set(r.roleId, r.role)));
    return [...map.values()];
  }, [allRoles, list]);

  function openCreate() {
    setEditing(null);
    setForm({ username: '', displayName: '', email: '', password: '', enabled: true, roleIds: [] });
    setModalOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditing(user);
    setForm({
      username: user.username,
      displayName: user.displayName,
      email: user.email ?? '',
      password: '',
      enabled: user.status === 'ENABLED',
      roleIds: (user.roles ?? []).map((r) => r.roleId),
    });
    setModalOpen(true);
  }

  function toggleRole(id: string) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter((r) => r !== id) : [...f.roleIds, id],
    }));
  }

  async function handleSave() {
    if (saving) return;
    if (!editing) {
      if (!form.username.trim() || !form.email.trim() || !form.password) {
        toast('请填写用户名 邮箱与初始密码', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      let res: Response;
      if (editing) {
        res = await fetch(`/api/console/users/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: form.displayName,
            email: form.email,
            status: form.enabled ? 'ENABLED' : 'DISABLED',
            roleIds: form.roleIds,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
      } else {
        res = await fetch('/api/console/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: form.username,
            displayName: form.displayName || form.username,
            email: form.email,
            password: form.password,
            roleIds: form.roleIds,
          }),
        });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || String(res.status));
      }
      toast(editing ? '用户已更新' : '用户已创建');
      setModalOpen(false);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast(msg || (editing ? '更新失败 请检查输入' : '创建失败 请检查输入'), 'error');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/console/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      toast('用户已删除');
      setDeleteTarget(null);
      load();
    } catch {
      toast('删除失败 请稍后重试', 'error');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3 anim-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="mt-1 text-sm text-fg-muted">账号 角色与状态一览</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          新建用户
        </button>
      </div>

      {/* 用户列表 */}
      <div className="rounded-lg border border-line bg-bg anim-fade-in-up" style={{ animationDelay: '0.05s' }}>
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="px-6 py-16 text-center text-fg-muted">
            <Users className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
            <p className="mt-3 text-sm">暂无用户</p>
          </div>
        ) : (
          <div className="divide-y divide-line stagger">
            {list.map((user) => {
              const badge = statusBadge(user.status);
              return (
                <div key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-bg-secondary/60 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(user.displayName || user.username || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{user.displayName || user.username}</span>
                      <span className="text-xs text-fg-muted">@{user.username}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.text}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">{user.email}</p>
                  </div>
                  <div className="hidden min-w-0 flex-col items-end gap-1 sm:flex">
                    <div className="flex flex-wrap justify-end gap-1">
                      {(user.roles ?? []).length === 0 ? (
                        <span className="text-xs text-fg-muted/60">无角色</span>
                      ) : (
                        (user.roles ?? []).map((r) => (
                          <span key={r.roleId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            <ShieldCheck className="h-3 w-3" />
                            {r.role.displayName || r.role.name}
                          </span>
                        ))
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                      <Lock className="h-3 w-3" />
                      最后登录 {fmtDateTime(user.lastLoginAt)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      title="编辑"
                      onClick={() => openEdit(user)}
                      className="rounded p-2 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      onClick={() => setDeleteTarget(user)}
                      className="rounded p-2 text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 新建/编辑模态 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `编辑用户 @${editing.username}` : '新建用户'}
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">用户名 *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="登录用用户名"
                className={inputClass}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">显示名称</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="展示用的昵称"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">邮箱 *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">{editing ? '重置密码' : '初始密码 *'}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={editing ? '留空则不修改密码' : '至少 6 位'}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {editing && (
            <label className="flex cursor-pointer items-center justify-between rounded border border-line px-3.5 py-2.5 transition-all duration-200 hover:border-primary/40">
              <span className="text-sm">账号状态<span className="ml-1.5 text-xs text-fg-muted">禁用后无法登录</span></span>
              <Toggle
                checked={form.enabled}
                onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                label="账号启用状态"
              />
            </label>
          )}

          <div className="space-y-2">
            <span className="text-sm text-fg-muted">角色</span>
            {roleOptions.length === 0 ? (
              <p className="rounded border border-dashed border-line px-4 py-3 text-center text-xs text-fg-muted">
                暂无可用角色 系统角色会随用户数据出现
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((r) => {
                  const selected = form.roleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
                        selected ? 'border-primary bg-primary/10 text-primary' : 'border-line text-fg-muted hover:border-fg-muted hover:text-fg'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {r.displayName || r.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        message={`确定删除用户「${deleteTarget?.displayName || (deleteTarget?.username ?? '')}」吗？该操作不可恢复`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
