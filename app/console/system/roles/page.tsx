'use client';

// app/console/system/roles/page.tsx — 角色管理（列表 / 创建 / 编辑 / 删除 + 权限勾选）
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';

interface PermissionInfo {
  id: string;
  name: string;
  displayName: string;
  group: string;
}

interface RoleItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  builtIn: boolean;
  permissions: { permissionId: string; permission: PermissionInfo }[];
  _count?: { users: number };
}

const inputClass =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function RolesPage() {
  return (
    <ToastProvider>
      <RolesContent />
    </ToastProvider>
  );
}

function RolesContent() {
  const toast = useToast();
  const [list, setList] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    displayName: '',
    description: '',
    permissionIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/console/roles');
      const data = await res.json();
      setList(data.list ?? []);
      setPermissions(data.permissions ?? []);
    } catch {
      toast('加载角色列表失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // 权限按 group 分组展示
  const permissionGroups = useMemo(() => {
    const map = new Map<string, PermissionInfo[]>();
    permissions.forEach((p) => {
      const arr = map.get(p.group) ?? [];
      arr.push(p);
      map.set(p.group, arr);
    });
    return [...map.entries()];
  }, [permissions]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', displayName: '', description: '', permissionIds: [] });
    setModalOpen(true);
  }

  function openEdit(role: RoleItem) {
    setEditing(role);
    setForm({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      permissionIds: role.permissions.map((p) => p.permissionId),
    });
    setModalOpen(true);
  }

  function togglePermission(id: string) {
    setForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(id)
        ? f.permissionIds.filter((p) => p !== id)
        : [...f.permissionIds, id],
    }));
  }

  async function handleSave() {
    if (saving) return;
    if (!form.displayName.trim()) {
      toast('请填写角色名称', 'error');
      return;
    }
    if (!editing && !form.name.trim()) {
      toast('请填写角色标识', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/console/roles/${editing.id}` : '/api/console/roles', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editing
            ? {
                displayName: form.displayName,
                description: form.description,
                // 内置角色后端会拒绝权限修改，这里就不提交权限字段
                ...(editing.builtIn ? {} : { permissionIds: form.permissionIds }),
              }
            : {
                name: form.name,
                displayName: form.displayName,
                description: form.description,
                permissionIds: form.permissionIds,
              },
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || '保存失败');
      toast(editing ? '角色已更新' : '角色已创建');
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : '保存失败 请检查输入', 'error');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/console/roles/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || '删除失败');
      toast('角色已删除');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : '删除失败 请稍后重试', 'error');
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-end gap-3 anim-fade-in-up">
        <button type="button" onClick={openCreate} className="liquid-btn liquid-btn-sm inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          新建角色
        </button>
      </div>

      {/* 角色列表 */}
      <div className="rounded-lg border border-line bg-bg anim-fade-in-up" style={{ animationDelay: '0.05s' }}>
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="px-6 py-16 text-center text-fg-muted">
            <ShieldCheck className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
            <p className="mt-3 text-sm">暂无角色</p>
          </div>
        ) : (
          <div className="divide-y divide-line stagger">
            {list.map((role) => (
              <div key={role.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-bg-secondary/60 sm:px-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{role.displayName}</span>
                    <span className="text-xs text-fg-muted">{role.name}</span>
                    {role.builtIn && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">内置</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {role.description || `共 ${role.permissions.length} 项权限`}
                  </p>
                </div>
                <div className="hidden items-center gap-4 text-xs text-fg-muted sm:flex">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {role._count?.users ?? 0} 位用户
                  </span>
                  <span>{role.permissions.length} 项权限</span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title="编辑"
                    onClick={() => openEdit(role)}
                    className="rounded p-2 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={role.builtIn ? '内置角色不可删除' : '删除'}
                    disabled={role.builtIn}
                    onClick={() => setDeleteTarget(role)}
                    className="rounded p-2 text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建/编辑模态 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `编辑角色 ${editing.displayName}` : '新建角色'}
        maxWidth="max-w-2xl"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">角色标识 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如 editor"
                disabled={!!editing?.builtIn}
                className={`${inputClass} disabled:opacity-60`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">角色名称 *</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="展示用名称"
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">描述</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="选填"
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">
                权限
                {editing?.builtIn && <span className="ml-2 text-xs text-red-500">内置角色权限不可修改</span>}
              </span>
              {!editing?.builtIn && (
                <span className="text-xs text-fg-muted">已选 {form.permissionIds.length} 项</span>
              )}
            </div>
            <div className="max-h-[46vh] space-y-4 overflow-y-auto rounded border border-line p-3">
              {permissionGroups.length === 0 ? (
                <p className="py-4 text-center text-xs text-fg-muted">暂无权限数据</p>
              ) : (
                permissionGroups.map(([group, items]) => (
                  <div key={group} className="space-y-2">
                    <p className="text-xs font-medium text-fg-muted">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map((p) => {
                        const selected = form.permissionIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={!!editing?.builtIn}
                            onClick={() => togglePermission(p.id)}
                            className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                              selected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-line text-fg-muted hover:border-fg-muted hover:text-fg'
                            }`}
                          >
                            {p.displayName || p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        message={`确定删除角色「${deleteTarget?.displayName ?? ''}」吗？该操作不可恢复`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
