'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Bookmark,
  Calendar,
  Camera,
  FileText,
  Folder,
  GripVertical,
  Heart,
  Home,
  Image,
  Images,
  Info,
  Link as LinkIcon,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Rss,
  Search,
  Settings,
  Star,
  Tag,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Modal, { ConfirmDialog } from '@/components/admin/Modal';

interface MenuNode {
  id: string;
  name: string;
  url: string;
  icon?: string | null;
  order: number;
  parentId?: string | null;
}

/** 常用图标预览 子集避免整包引入 */
const ICON_MAP: Record<string, typeof Home> = {
  Home,
  FileText,
  Image,
  Images,
  Link: LinkIcon,
  Mail,
  User,
  Users,
  Settings,
  MessageSquare,
  Folder,
  Tag,
  Rss,
  Search,
  Info,
  Bookmark,
  Archive,
  Calendar,
  Camera,
  Heart,
  Star,
};

const inputClass =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function MenuPage() {
  return (
    <ToastProvider>
      <MenuContent />
    </ToastProvider>
  );
}

function MenuContent() {
  const toast = useToast();
  const [list, setList] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', icon: '', order: '0', parentId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      const items: MenuNode[] = data.list ?? [];
      setList(
        items.map((m) => ({ ...m, order: m.order ?? 0 })).sort((a, b) => a.order - b.order)
      );
    } catch {
      toast('加载菜单失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const tops = useMemo(() => list.filter((m) => !m.parentId), [list]);
  const childrenOf = useCallback((id: string) => list.filter((m) => m.parentId === id), [list]);

  /** 拖拽状态（仅同级之间拖拽排序） */
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  /** 按新顺序回写同级兄弟（拖拽与上下移动共用） */
  async function persistOrder(siblings: MenuNode[]) {
    // 乐观更新：先本地改，再异步持久化
    const siblingIds = new Set(siblings.map((s) => s.id));
    setList((prev) => {
      const others = prev.filter((m) => !siblingIds.has(m.id));
      const withNewOrder = siblings.map((m, i) => ({ ...m, order: i }));
      return [...others, ...withNewOrder].sort((a, b) => a.order - b.order);
    });
    try {
      await Promise.all(
        siblings.map((m, i) =>
          fetch(`/api/menu/${m.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: m.name, url: m.url, icon: m.icon ?? undefined, order: i, parentId: m.parentId ?? null }),
          })
        )
      );
      toast('排序已更新');
    } catch {
      toast('排序失败 请稍后重试', 'error');
      load(); // 失败才回滚刷新
    }
  }

  /** HTML5 拖拽：拖到目标项位置，目标前后按拖拽方向插入 */
  async function handleDrop(target: MenuNode) {
    const sourceId = dragId;
    setDragId(null);
    setDropTargetId(null);
    if (!sourceId || sourceId === target.id || moving) return;

    const siblings = list.filter((m) => (m.parentId ?? null) === (target.parentId ?? null));
    const source = siblings.find((m) => m.id === sourceId);
    // 只允许同级之间拖拽（与目标不在同一层则忽略）
    if (!source || (source.parentId ?? null) !== (target.parentId ?? null)) return;

    const from = siblings.findIndex((m) => m.id === sourceId);
    const to = siblings.findIndex((m) => m.id === target.id);
    const reordered = [...siblings];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    setMoving(sourceId);
    await persistOrder(reordered);
    setMoving(null);
  }

  /** 上下移动 与同级相邻项交换 order 并全部回写 */
  async function move(item: MenuNode, dir: -1 | 1) {
    if (moving) return;
    const siblings = list.filter((m) => (m.parentId ?? null) === (item.parentId ?? null));
    const idx = siblings.findIndex((m) => m.id === item.id);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= siblings.length) return;
    const swapped = [...siblings];
    const tmp = swapped[idx];
    swapped[idx] = swapped[targetIdx];
    swapped[targetIdx] = tmp;
    setMoving(item.id);
    try {
      await persistOrder(swapped);
    } finally {
      setMoving(null);
    }
  }

  function openCreate(parentId = '') {
    setEditing(null);
    setForm({ name: '', url: '', icon: '', order: '0', parentId });
    setModalOpen(true);
  }

  function openEdit(item: MenuNode) {
    setEditing(item);
    setForm({
      name: item.name,
      url: item.url,
      icon: item.icon ?? '',
      order: String(item.order ?? 0),
      parentId: item.parentId ?? '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (saving) return;
    if (!form.name.trim() || !form.url.trim()) {
      toast('请填写菜单名称与链接', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        url: form.url,
        icon: form.icon || undefined,
        order: form.order ? Number(form.order) : 0,
        parentId: form.parentId || null,
      };
      const res = await fetch(editing ? `/api/menu/${editing.id}` : '/api/menu', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(editing ? '菜单已更新' : '菜单已创建');
      setModalOpen(false);
      // 乐观更新列表，不刷新
      if (editing) {
        setList((prev) => prev.map((m) => (m.id === editing.id ? { ...m, ...body } : m)));
      } else {
        const data = await res.json().catch(() => null);
        const newItem: MenuNode = {
          id: data?.id ?? crypto.randomUUID(),
          name: body.name,
          url: body.url,
          icon: body.icon ?? null,
          order: body.order,
          parentId: body.parentId,
        };
        setList((prev) => [...prev, newItem].sort((a, b) => a.order - b.order));
      }
    } catch {
      toast('保存失败 请稍后重试', 'error');
      load();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    const idToRemove = deleteTarget.id;
    setDeleteTarget(null);
    // 乐观更新：先从列表移除（包括子级）
    setList((prev) => prev.filter((m) => m.id !== idToRemove && m.parentId !== idToRemove));
    try {
      const res = await fetch(`/api/menu/${idToRemove}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      toast('菜单已删除');
    } catch {
      toast('删除失败 请稍后重试', 'error');
      load(); // 失败回滚
    }
  }

  /** 可选父级 仅顶级菜单 排除自身与直接子级 避免成环 */
  const parentOptions = useMemo(() => {
    if (!editing) return tops;
    return tops.filter((m) => m.id !== editing.id && m.parentId !== editing.id);
  }, [tops, editing]);

  const PreviewIcon = ICON_MAP[form.icon];

  function renderRow(item: MenuNode, isChild: boolean) {
    const Icon = item.icon ? ICON_MAP[item.icon] : undefined;
    const siblings = list.filter((m) => (m.parentId ?? null) === (item.parentId ?? null));
    const idx = siblings.findIndex((m) => m.id === item.id);
    const isDragging = dragId === item.id;
    const isDropTarget = dropTargetId === item.id && dragId !== null && dragId !== item.id;
    return (
      <div
        draggable
        onDragStart={() => setDragId(item.id)}
        onDragEnd={() => {
          setDragId(null);
          setDropTargetId(null);
        }}
        onDragOver={(e) => {
          if (dragId && dragId !== item.id) {
            e.preventDefault();
            setDropTargetId(item.id);
          }
        }}
        onDragLeave={() => setDropTargetId((cur) => (cur === item.id ? null : cur))}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(item);
        }}
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-bg px-4 py-3 transition-all duration-300 hover:border-primary/40 hover:shadow-sm ${
          isChild ? 'border-line/70 bg-bg-secondary/50' : 'border-line'
        } ${isDragging ? 'opacity-40 scale-[0.98]' : ''} ${
          isDropTarget ? 'border-primary ring-2 ring-primary/30 border-dashed' : ''
        }`}
      >
        {/* 拖拽手柄 */}
        <span
          className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-fg-muted/50 transition-colors hover:text-primary active:cursor-grabbing"
          title="拖拽排序"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isChild ? 'bg-primary/10 text-primary' : 'bg-bg-secondary text-fg-muted'
          }`}
        >
          {Icon ? <Icon className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.icon && <span className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-fg-muted">{item.icon}</span>}
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">{item.url}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="mr-1 rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-fg-muted">#{item.order}</span>
          <button
            type="button"
            title="上移"
            disabled={idx <= 0 || moving !== null}
            onClick={() => move(item, -1)}
            className="rounded p-1.5 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90 disabled:opacity-30 disabled:hover:text-fg-muted"
          >
            {moving === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            title="下移"
            disabled={idx >= siblings.length - 1 || moving !== null}
            onClick={() => move(item, 1)}
            className="rounded p-1.5 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90 disabled:opacity-30 disabled:hover:text-fg-muted"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="编辑"
            onClick={() => openEdit(item)}
            className="rounded p-1.5 text-fg-muted transition-all duration-200 hover:bg-bg-secondary hover:text-primary active:scale-90"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="删除"
            onClick={() => setDeleteTarget(item)}
            className="rounded p-1.5 text-fg-muted transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-end gap-3 anim-fade-in-up">
        <button
          type="button"
          onClick={() => openCreate()}
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          新建菜单
        </button>
      </div>

      {/* 菜单树 */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      ) : tops.length === 0 ? (
        <div className="anim-fade-in rounded-lg border border-dashed border-line px-6 py-16 text-center text-fg-muted">
          <Folder className="mx-auto h-10 w-10 text-fg-muted/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm">还没有菜单 点击右上角新建</p>
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {tops.map((top) => (
            <div key={top.id} className="space-y-2">
              {renderRow(top, false)}
              {childrenOf(top.id).length > 0 && (
                <div className="ml-6 space-y-2 border-l-2 border-line pl-4 sm:ml-10">
                  {childrenOf(top.id).map((child) => renderRow(child, true))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 新建/编辑模态 */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '编辑菜单' : '新建菜单'}
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
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="如 首页"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">链接 *</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="/ 或 /web/archives"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-fg-muted">
              图标 <span className="text-xs">lucide 图标名 如 Home / Rss</span>
            </label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="Home"
              className={inputClass}
            />
            {form.icon && (
              <p className="flex items-center gap-2 text-xs text-fg-muted anim-fade-in">
                {PreviewIcon ? (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded border border-line bg-bg-secondary">
                      <PreviewIcon className="h-4 w-4 text-primary" />
                    </span>
                    已识别图标 {form.icon}
                  </>
                ) : (
                  <>未在常用图标中识别 以前台实际渲染为准</>
                )}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">排序</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">父级菜单</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">无（顶级菜单）</option>
                {parentOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        message={`确定删除菜单「${deleteTarget?.name ?? ''}」吗？其子菜单将保留为顶级菜单`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
