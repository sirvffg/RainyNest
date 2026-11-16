'use client';

import Toggle from './Toggle';

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigField {
  type: string;
  label?: string;
  default?: unknown;
  placeholder?: string;
  help?: string;
  options?: (string | ConfigFieldOption)[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
}

export interface ConfigSchemaGroup {
  label?: string;
  fields?: Record<string, ConfigField>;
}

export type ConfigSchema = Record<string, ConfigSchemaGroup>;

/** options 统一归一化为 {value,label}[] */
function normalizeOptions(options?: (string | ConfigFieldOption)[]): ConfigFieldOption[] {
  return (options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

/** 按字段类型纠正历史值/当前值（如文本框误存的 "true" 字符串、数字字符串） */
function coerceValue(field: ConfigField, v: unknown): unknown {
  if (field.type === 'switch' || field.type === 'boolean') {
    if (typeof v === 'string') return v === 'true' || v === '1' || v === 'on';
    return Boolean(v);
  }
  if (field.type === 'number' || field.type === 'range') {
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return v;
  }
  if (field.type === 'checkboxes') {
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    if (Array.isArray(v)) return v;
    return [];
  }
  return v;
}

/** 根据主题/插件的 configSchema 合并出默认配置对象（并对历史值做类型纠正） */
export function buildDefaultConfig(schema: ConfigSchema, current?: Record<string, unknown> | null) {
  const config: Record<string, unknown> = { ...(current ?? {}) };
  for (const group of Object.values(schema ?? {})) {
    for (const [key, field] of Object.entries(group.fields ?? {})) {
      if (config[key] === undefined || config[key] === null) {
        const fallback =
          field.default ??
          (field.type === 'switch' || field.type === 'boolean'
            ? false
            : field.type === 'checkboxes'
              ? []
              : field.type === 'number' || field.type === 'range'
                ? field.min ?? 0
                : '');
        config[key] = fallback;
      }
      // 历史值类型纠正（例如旧版本文本框存下的 "true" / "5"）
      config[key] = coerceValue(field, config[key]);
    }
  }
  return config;
}

export default function ConfigForm({
  schema,
  value,
  onChange,
}: {
  schema: ConfigSchema;
  value: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
}) {
  const groups = Object.entries(schema ?? {});
  if (groups.length === 0) {
    return <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-fg-muted">该扩展没有可配置项</p>;
  }

  const inputClass =
    'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="space-y-5 stagger">
      {groups.map(([groupKey, group]) => (
        <section key={groupKey} className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {group.label ?? groupKey}
          </h3>
          <div className="space-y-2.5">
            {Object.entries(group.fields ?? {}).map(([fieldKey, field]) => {
              const label = field.label ?? fieldKey;
              const help = field.help ? <p className="text-xs text-fg-muted">{field.help}</p> : null;

              // 开关（switch 为 boolean 别名）
              if (field.type === 'switch' || field.type === 'boolean') {
                return (
                  <label
                    key={fieldKey}
                    className="flex cursor-pointer items-center justify-between rounded border border-line bg-bg px-3.5 py-2.5 transition-all duration-200 hover:border-primary/40"
                  >
                    <span className="text-sm">{label}</span>
                    <Toggle checked={Boolean(value[fieldKey])} onChange={(v) => onChange(fieldKey, v)} label={label} />
                  </label>
                );
              }

              // 数字
              if (field.type === 'number') {
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      placeholder={field.placeholder}
                      value={String(value[fieldKey] ?? '')}
                      onChange={(e) => onChange(fieldKey, e.target.value === '' ? '' : Number(e.target.value))}
                      className={inputClass}
                    />
                    {help}
                  </div>
                );
              }

              // 滑块
              if (field.type === 'range' || field.type === 'slider') {
                const num = Number(value[fieldKey] ?? field.min ?? 0);
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-fg-muted">{label}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-all duration-200">{num}</span>
                    </div>
                    <input
                      type="range"
                      min={field.min ?? 0}
                      max={field.max ?? 100}
                      step={field.step ?? 1}
                      value={num}
                      onChange={(e) => onChange(fieldKey, Number(e.target.value))}
                      className="w-full accent-[var(--primary,#3b82f6)]"
                    />
                    {help}
                  </div>
                );
              }

              // 下拉选择
              if (field.type === 'select') {
                const opts = normalizeOptions(field.options);
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <select
                      value={String(value[fieldKey] ?? '')}
                      onChange={(e) => onChange(fieldKey, e.target.value)}
                      className={`${inputClass} cursor-pointer appearance-none`}
                    >
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {help}
                  </div>
                );
              }

              // 单选组
              if (field.type === 'radio') {
                const opts = normalizeOptions(field.options);
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <div className="flex flex-wrap gap-2">
                      {opts.map((o) => {
                        const active = String(value[fieldKey] ?? '') === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => onChange(fieldKey, o.value)}
                            className={`rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 hover:scale-[1.03] active:scale-95 ${
                              active
                                ? 'border-primary bg-primary/10 font-medium text-primary'
                                : 'border-line bg-bg text-fg-muted hover:border-primary/40'
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                    {help}
                  </div>
                );
              }

              // 多选组（数组值）
              if (field.type === 'checkboxes' || field.type === 'multiselect') {
                const opts = normalizeOptions(field.options);
                const selected = Array.isArray(value[fieldKey]) ? (value[fieldKey] as unknown[]) : [];
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <div className="flex flex-wrap gap-2">
                      {opts.map((o) => {
                        const active = selected.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? selected.filter((s) => s !== o.value)
                                : [...selected, o.value];
                              onChange(fieldKey, next);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 hover:scale-[1.03] active:scale-95 ${
                              active
                                ? 'border-primary bg-primary/10 font-medium text-primary'
                                : 'border-line bg-bg text-fg-muted hover:border-primary/40'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${active ? 'scale-100 bg-primary' : 'scale-75 bg-line'}`}
                            />
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                    {help}
                  </div>
                );
              }

              // 多行文本
              if (field.type === 'textarea') {
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <textarea
                      rows={field.rows ?? 4}
                      placeholder={field.placeholder}
                      value={String(value[fieldKey] ?? '')}
                      onChange={(e) => onChange(fieldKey, e.target.value)}
                      className={`${inputClass} resize-y`}
                    />
                    {help}
                  </div>
                );
              }

              // 颜色
              if (field.type === 'color') {
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={String(value[fieldKey] ?? '#3b82f6')}
                        onChange={(e) => onChange(fieldKey, e.target.value)}
                        className="h-9 w-12 shrink-0 cursor-pointer rounded border border-line bg-bg p-1 transition-all duration-200"
                      />
                      <input
                        type="text"
                        value={String(value[fieldKey] ?? '')}
                        onChange={(e) => onChange(fieldKey, e.target.value)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    {help}
                  </div>
                );
              }

              // 日期 / 时间类
              if (['date', 'time', 'datetime-local'].includes(field.type)) {
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <input
                      type={field.type}
                      value={String(value[fieldKey] ?? '')}
                      onChange={(e) => onChange(fieldKey, e.target.value)}
                      className={inputClass}
                    />
                    {help}
                  </div>
                );
              }

              // 链接 / 邮箱等单行输入（text/url/email/password 兜底）
              const htmlType = ['url', 'email', 'password'].includes(field.type) ? field.type : 'text';
              return (
                <div key={fieldKey} className="space-y-1.5">
                  <span className="text-sm text-fg-muted">{label}</span>
                  <input
                    type={htmlType}
                    placeholder={field.placeholder}
                    value={String(value[fieldKey] ?? '')}
                    onChange={(e) => onChange(fieldKey, e.target.value)}
                    className={inputClass}
                  />
                  {help}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
