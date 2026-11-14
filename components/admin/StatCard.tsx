// components/admin/StatCard.tsx — 仪表盘统计卡片（配合父级 .stagger 入场）

import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
}

export default function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <div className="group anim-fade-in-up rounded-lg border border-line bg-bg p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded bg-blue-50 text-blue-500 transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value.toLocaleString('zh-CN')}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}
