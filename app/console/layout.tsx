// app/console/layout.tsx — 后台布局：登录校验 + 框架壳

import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ConsoleShell from '@/components/admin/ConsoleShell';
import { getPluginNavItems } from '@/lib/plugin/admin';
// 后台专用字体：HarmonyOS Sans SC（本地自托管）
import './harmonyos-font.css';

export const metadata: Metadata = {
  title: { default: '控制台', template: '%s - RainyNest 控制台' },
};

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/signin?redirect=/console');

  const user = {
    displayName: session.user.name || session.user.username || '管理员',
    roles: session.user.roles ?? [],
  };

  // 插件注入的后台菜单（customAdminRoutes 扩展点）
  const pluginNav = await getPluginNavItems();

  return <ConsoleShell user={user} pluginNav={pluginNav}>{children}</ConsoleShell>;
}
