'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FileCode2,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Palette,
  Save,
  Search,
} from 'lucide-react';
import ToastProvider, { useToast } from '@/components/admin/Toast';
import Toggle from '@/components/admin/Toggle';
import ImageInput from '@/components/admin/ImageInput';

type SettingsMap = Record<string, unknown>;

const TABS = [
  { key: 'basic', label: '基本', icon: Globe },
  { key: 'seo', label: 'SEO', icon: Search },
  { key: 'interact', label: '互动', icon: MessageSquare },
  { key: 'markdown', label: 'Markdown', icon: FileCode2 },
  { key: 'smtp', label: 'SMTP', icon: Mail },
  { key: 'appearance', label: '外观', icon: Palette },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const PRESET_COLORS = ['#3b82f6', '#0f172a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const inputClass =
  'w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsContent />
    </ToastProvider>
  );
}

function SettingsContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 液态玻璃 Tab 栏：滑块位置 / 首次渲染不带动画 / 鼠标反光
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const tabsAnimatedRef = useRef(false);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });
  const [tabsAnimated, setTabsAnimated] = useState(false);

  const measureTab = useCallback(() => {
    const nav = tabsNavRef.current;
    const btn = nav?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    if (!nav || !btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setTabIndicator({
      left: btnRect.left - navRect.left - nav.clientLeft + nav.scrollLeft - 7,
      width: btnRect.width,
    });
    // 首次定位完成后再开启过渡，避免滑块从 0 宽滑入
    if (!tabsAnimatedRef.current && btnRect.width > 0) {
      tabsAnimatedRef.current = true;
      window.setTimeout(() => setTabsAnimated(true), 120);
    }
  }, [activeTab]);

  // loading 结束后 tab 栏才挂载，需要重新测量
  useLayoutEffect(() => {
    measureTab();
  }, [measureTab, loading]);

  useEffect(() => {
    const onResize = () => measureTab();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureTab]);

  function handleTabsPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
  }

  // 保存按钮：液态玻璃的鼠标追踪高光
  function handleLiquidMove(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }

  function handleLiquidLeave(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.style.setProperty('--mx', '50%');
    e.currentTarget.style.setProperty('--my', '50%');
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/console/settings');
      const data = await res.json();
      setSettings(data ?? {});
    } catch {
      toast('加载设置失败', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function set(key: string, value: unknown) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const body: SettingsMap = { ...settings };
      // 数字字段空值兜底
      if (body.codeCollapseThreshold == null || body.codeCollapseThreshold === '') body.codeCollapseThreshold = 15;
      if (body.smtpPort == null || body.smtpPort === '') body.smtpPort = null;
      const res = await fetch('/api/console/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      // 保存外观时同步主色变量 即时生效；hover 色按主题规则（-32）一起派生，避免沿用旧色
      const color = typeof settings.primaryColor === 'string' ? settings.primaryColor : '';
      if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        const num = parseInt(color.replace('#', ''), 16);
        const clamp = (v: number) => Math.max(0, Math.min(255, v));
        const hover = `#${(
          (clamp((num >> 16) - 32) << 16) |
          (clamp(((num >> 8) & 0xff) - 32) << 8) |
          clamp((num & 0xff) - 32)
        )
          .toString(16)
          .padStart(6, '0')}`;
        document.documentElement.style.setProperty('--color-primary', color);
        document.documentElement.style.setProperty('--color-primary-hover', hover);
      }
      toast('设置已保存');
    } catch {
      toast('保存失败 请稍后重试', 'error');
    }
    setSaving(false);
  }

  function text(key: string, label: string, placeholder?: string) {
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-sm text-fg-muted">{label}</label>
        <input
          type="text"
          value={String(settings[key] ?? '')}
          onChange={(e) => set(key, e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      </div>
    );
  }

  function textarea(key: string, label: string, placeholder?: string) {
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-sm text-fg-muted">{label}</label>
        <textarea
          value={String(settings[key] ?? '')}
          onChange={(e) => set(key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    );
  }

  function number(key: string, label: string) {
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-sm text-fg-muted">{label}</label>
        <input
          type="number"
          value={settings[key] == null ? '' : String(settings[key])}
          onChange={(e) => set(key, e.target.value === '' ? null : Number(e.target.value))}
          className={inputClass}
        />
      </div>
    );
  }

  function selectField(key: string, label: string, hint: string, options: { value: string; label: string }[]) {
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-sm text-fg-muted">{label}</label>
        <select
          value={String(settings[key] ?? 'auto')}
          onChange={(e) => set(key, e.target.value)}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-fg-muted">{hint}</p>
      </div>
    );
  }

  function toggleRow(key: string, label: string, hint?: string) {
    return (
      <label
        key={key}
        className="flex cursor-pointer items-center justify-between rounded border border-line bg-bg px-4 py-3 transition-all duration-200 hover:border-primary/40"
      >
        <span>
          <span className="block text-sm">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-fg-muted">{hint}</span>}
        </span>
        <Toggle checked={Boolean(settings[key])} onChange={(v) => set(key, v)} label={label} />
      </label>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="anim-fade-in-up">
        <h1 className="text-2xl font-bold">系统设置</h1>
        <p className="mt-1 text-sm text-fg-muted">站点信息 互动与渲染行为皆在此调整</p>
      </div>

      {/* Tab 栏：液态玻璃导航（滑块跟随 + 鼠标反光） */}
      <div
        ref={tabsNavRef}
        onPointerMove={handleTabsPointerMove}
        className="glass-tabs anim-fade-in-up"
        style={{ animationDelay: '0.05s' }}
      >
        <span
          aria-hidden="true"
          className={`glass-tabs-indicator ${tabsAnimated ? '' : 'glass-tabs-indicator--instant'}`}
          style={{ width: tabIndicator.width, transform: `translateX(${tabIndicator.left}px)` }}
        />
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            data-tab={key}
            onClick={() => setActiveTab(key)}
            className={`glass-tabs-item ${activeTab === key ? 'is-active' : ''}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div key={activeTab} className="anim-fade-in-up rounded-lg border border-line bg-bg p-4 sm:p-6">
        <div className="space-y-4 stagger">
          {activeTab === 'basic' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {text('title', '站点标题')}
                {text('subtitle', '站点副标题')}
              </div>
              {textarea('description', '站点描述')}
              {text('url', '站点 URL', 'https://example.com')}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm text-fg-muted">站点 Logo</label>
                  <ImageInput value={String(settings.logo ?? '')} onChange={(v) => set('logo', v)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-fg-muted">Favicon</label>
                  <ImageInput value={String(settings.favicon ?? '')} onChange={(v) => set('favicon', v)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {text('icp', 'ICP 备案号', '如 京ICP备xxxxxxxx号')}
                {text('footerText', '页脚文字')}
              </div>
            </>
          )}

          {activeTab === 'seo' && (
            <>
              {text('keywords', '关键词', '多个关键词以英文逗号分隔')}
              {text('author', '作者')}
              {text('googleVerification', 'Google 站点验证码')}
              {text('baiduVerification', '百度站点验证码')}
            </>
          )}

          {activeTab === 'interact' && (
            <>
              {toggleRow('allowRegister', '开放注册', '允许访客注册账号')}
              {toggleRow('commentModeration', '评论先审后发', '新评论需审核通过后展示')}
              {toggleRow('enableRss', '启用 RSS', '提供订阅源输出')}
              {toggleRow('enableSitemap', '启用 Sitemap', '生成站点地图供搜索引擎抓取')}
              {selectField(
                'ipSource',
                '访客 IP 获取方式',
                '宝塔/1P 反代或 CDN 已写头的选对应项；拿不准选自动',
                [
                  { value: 'auto', label: '自动（按代理头优先级判断）' },
                  { value: 'x-forwarded-for', label: 'X-Forwarded-For（通用反代）' },
                  { value: 'x-real-ip', label: 'X-Real-IP（nginx 常用）' },
                  { value: 'cf-connecting-ip', label: 'CF-Connecting-IP（Cloudflare）' },
                  { value: 'custom', label: '自定义代理头' },
                  { value: 'direct', label: '直连（不读任何头）' },
                ],
              )}
              {settings.ipSource === 'custom' &&
                text('ipCustomHeader', '自定义代理头名称', '如 X-CDN-Real-IP 大小写不限')}
            </>
          )}

          {activeTab === 'markdown' && (
            <>
              {toggleRow('codeShowLineNumbers', '代码块显示行号')}
              {toggleRow('codeCollapsible', '代码块可折叠', '超过阈值的代码块自动折叠')}
              {number('codeCollapseThreshold', '折叠阈值（行数）')}
              {toggleRow('enableCallouts', '启用 Callout 提示块')}
              {toggleRow('enableMath', '启用数学公式渲染')}
              {toggleRow('enableWikiLink', '启用 WikiLink 语法', '支持 [[页面名]] 双链')}
              {toggleRow('enableReadingTime', '显示阅读时长')}
              {toggleRow('enableEmailProtection', '邮箱地址防爬保护')}
            </>
          )}

          {activeTab === 'smtp' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {text('smtpHost', 'SMTP 服务器', 'smtp.example.com')}
                {number('smtpPort', 'SMTP 端口')}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {text('smtpUser', 'SMTP 用户名')}
                <div className="space-y-1.5">
                  <label className="text-sm text-fg-muted">SMTP 密码 / 授权码</label>
                  <input
                    type="password"
                    value={String(settings.smtpPass ?? '')}
                    onChange={(e) => set('smtpPass', e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {text('smtpFrom', '发件人地址', 'noreply@example.com')}
              <p className="rounded bg-bg-secondary px-3.5 py-2.5 text-xs leading-relaxed text-fg-muted">
                配置 SMTP 后 评论通知等邮件才能正常发送 密码建议使用邮箱服务商提供的授权码
              </p>
            </>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-1.5">
              <label className="text-sm text-fg-muted">主题主色</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(String(settings.primaryColor ?? '')) ? String(settings.primaryColor) : '#3b82f6'}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded border border-line bg-bg p-1"
                />
                <input
                  type="text"
                  value={String(settings.primaryColor ?? '')}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  placeholder="#3b82f6"
                  className={`${inputClass} max-w-[180px] font-mono`}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => set('primaryColor', c)}
                    className={`h-8 w-8 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                      settings.primaryColor === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-bg' : 'ring-1 ring-line'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 保存 */}
      <div className="flex justify-end anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <button
          type="button"
          onClick={handleSave}
          onPointerMove={handleLiquidMove}
          onPointerLeave={handleLiquidLeave}
          disabled={saving}
          className="liquid-btn"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? '保存中' : '保存设置'}</span>
        </button>
      </div>
    </div>
  );
}
