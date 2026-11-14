'use client';

import Toggle from './Toggle';

export interface ConfigField {
  type: string;
  label?: string;
  default?: unknown;
}

export interface ConfigSchemaGroup {
  label?: string;
  fields?: Record<string, ConfigField>;
}

export type ConfigSchema = Record<string, ConfigSchemaGroup>;

/** 根据主题/插件的 configSchema 合并出默认配置对象 */
export function buildDefaultConfig(schema: ConfigSchema, current?: Record<string, unknown> | null) {
  const config: Record<string, unknown> = { ...(current ?? {}) };
  for (const group of Object.values(schema ?? {})) {
    for (const [key, field] of Object.entries(group.fields ?? {})) {
      if (config[key] === undefined || config[key] === null) {
        config[key] = field.default ?? (field.type === 'boolean' ? false : '');
      }
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
              if (field.type === 'boolean') {
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
              if (field.type === 'number') {
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <input
                      type="number"
                      value={String(value[fieldKey] ?? '')}
                      onChange={(e) => onChange(fieldKey, e.target.value === '' ? '' : Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                );
              }
              if (field.type === 'color') {
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <span className="text-sm text-fg-muted">{label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={String(value[fieldKey] ?? '#3b82f6')}
                        onChange={(e) => onChange(fieldKey, e.target.value)}
                        className="h-9 w-12 shrink-0 cursor-pointer rounded border border-line bg-bg p-1"
                      />
                      <input
                        type="text"
                        value={String(value[fieldKey] ?? '')}
                        onChange={(e) => onChange(fieldKey, e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <div key={fieldKey} className="space-y-1.5">
                  <span className="text-sm text-fg-muted">{label}</span>
                  <input
                    type="text"
                    value={String(value[fieldKey] ?? '')}
                    onChange={(e) => onChange(fieldKey, e.target.value)}
                    className={inputClass}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
