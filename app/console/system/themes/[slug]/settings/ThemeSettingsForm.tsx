'use client';

// app/console/system/themes/[slug]/settings/ThemeSettingsForm.tsx — 主题配置表单（客户端）
import { useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import ConfigForm, { buildDefaultConfig, type ConfigSchema } from '@/components/admin/ConfigForm';

interface Props {
  slug: string;
  schema: ConfigSchema;
  /** 已合并默认值的分组配置（DB 结构：{ group: { field: value } }） */
  initialConfig: Record<string, unknown>;
}

// 分组配置 → 表单扁平结构（ConfigForm 只认 fieldKey 一级）
function flattenConfig(schema: ConfigSchema, grouped: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [groupKey, group] of Object.entries(schema ?? {})) {
    const groupValue = (grouped?.[groupKey] ?? {}) as Record<string, unknown>;
    for (const fieldKey of Object.keys(group.fields ?? {})) {
      flat[fieldKey] = groupValue[fieldKey];
    }
  }
  return flat;
}

// 表单扁平结构 → 分组配置（与 theme.js 的 configToCssVariables 保持一致）
function groupConfig(schema: ConfigSchema, flat: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const [groupKey, group] of Object.entries(schema ?? {})) {
    grouped[groupKey] = {};
    for (const fieldKey of Object.keys(group.fields ?? {})) {
      grouped[groupKey][fieldKey] = flat[fieldKey];
    }
  }
  return grouped;
}

export default function ThemeSettingsForm(props: Props) {
  return (
    <ToastProvider>
      <ThemeSettingsFormContent {...props} />
    </ToastProvider>
  );
}

function ThemeSettingsFormContent({ slug, schema, initialConfig }: Props) {
  const toast = useToast();
  const initialFlat = () => buildDefaultConfig(schema, flattenConfig(schema, initialConfig));
  const [config, setConfig] = useState<Record<string, unknown>>(initialFlat);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/console/themes/${encodeURIComponent(slug)}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: groupConfig(schema, config) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '保存失败');
      toast('主题配置已保存');
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败 请稍后重试', 'error');
    }
    setSaving(false);
  }

  return (
    <div className="anim-fade-in space-y-5 rounded-lg border border-line bg-bg p-5">
      <ConfigForm
        schema={schema}
        value={config}
        onChange={(key, v) => setConfig((c) => ({ ...c, [key]: v }))}
      />

      <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setConfig(initialFlat())}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded border border-line px-4 py-2 text-sm transition-all duration-200 hover:bg-bg-secondary active:scale-95 disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-4 w-4" />
          重置
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="liquid-btn liquid-btn-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中' : '保存配置'}
        </button>
      </div>
    </div>
  );
}
