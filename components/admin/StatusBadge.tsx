// components/admin/StatusBadge.tsx — 状态徽章（草稿/发布/定时 + 评论三态）

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  DRAFT: { label: '草稿', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  PUBLISHED: { label: '已发布', cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  SCHEDULED: { label: '定时发布', cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  PENDING: { label: '待审核', cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  APPROVED: { label: '已通过', cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  REJECTED: { label: '已拒绝', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-bg-secondary text-fg-muted', dot: 'bg-fg-muted' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-transform duration-200 hover:scale-105 ${s.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
