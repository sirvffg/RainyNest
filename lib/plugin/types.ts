// lib/plugin/types.ts — 插件接口定义（RainyNest SPI）
import type { PrismaClient, SiteSetting } from '@prisma/client';
import type { PrismaClient as AnalyticsPrismaClient } from '../../generated/prisma/analytics';
import type { Database } from 'better-sqlite3';
import type { ComponentType, ReactNode } from 'react';

// ═══════════════ 插件上下文 ═══════════════

export interface PluginLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface PluginContext {
  db: PrismaClient;                       // 主库
  analytics: AnalyticsPrismaClient;       // 访问库
  pluginDb: Database;                     // 插件独立库
  slug: string;
  version: string;
  config: Record<string, unknown>;
  site: SiteSetting;
  env: Record<string, string | undefined>;
  logger: PluginLogger;
  emitEvent: (name: string, data: unknown) => void;
}

// ═══════════════ 服务端扩展点 ═══════════════

export interface BeforeSavePostMeta {
  patch?: Record<string, unknown>;
}

export interface MetadataPatchInput {
  metadata: Record<string, unknown>;
  post: Record<string, unknown> | null;
}

export interface CustomApiRouteDef {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (req: Request) => Promise<Response>;
  auth: boolean;
}

export interface SearchProvider {
  name: string;
  builtIn?: boolean;
  search: (query: string, options?: { limit?: number; offset?: number }) => Promise<SearchResult[]>;
}

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  snippet: string;
  score: number;
}

// ═══════════════ 主题端 / 后台 UI 扩展点 ═══════════════

export interface SidebarWidgetDef {
  title?: string;
  component: ComponentType | (() => Promise<{ default: ComponentType }>);
  order?: number;
}

export interface DashboardWidgetDef {
  title: string;
  icon?: string;
  component: ComponentType | (() => Promise<{ default: ComponentType }>);
  permissions?: string[];
  colSpan?: number;
}

export interface ListItemOperationDef {
  label: string;
  icon?: string;
  variant?: 'default' | 'ghost' | 'outline';
  // 降级为链接型：作为 href 模板使用，支持 {id} {slug} 占位符
  // 如 '/console/plugin-ext/page-views/stats?postId={id}'
  onClick?: string;
  permissions?: string[];
}

export interface AdminRouteDef {
  path: string;
  title: string;
  icon?: string;
  group?: string;
  hideSidebar?: boolean;
  component: () => Promise<{ default: ComponentType }>;
}

export interface FrontendRouteDef {
  path: string;
  title: string;
  component: () => Promise<{ default: ComponentType }>;
  ssr?: boolean;
}

// ═══════════════ 扩展点汇总 ═══════════════

export interface ExtensionHandlers {
  // 服务端
  onMount?: (ctx: PluginContext) => void | Promise<void>;
  beforeSavePost?: (post: Record<string, unknown>, meta: BeforeSavePostMeta) => void | Promise<void>;
  // 评论审核扩展点：返回新状态（PENDING/APPROVED/REJECTED）或 void（用默认状态）
  beforeCommentApprove?: (comment: {
    postId: string;
    userId: string;
    content: string;
    parentId?: string | null;
    ip?: string;
    userAgent?: string;
  }) => 'PENDING' | 'APPROVED' | 'REJECTED' | void | Promise<'PENDING' | 'APPROVED' | 'REJECTED' | void>;
  afterSavePost?: (post: Record<string, unknown>) => void | Promise<void>;
  beforeDeletePost?: (postId: string) => void | Promise<void>;
  onGenerateMetadata?: (input: MetadataPatchInput) => Record<string, unknown> | Promise<Record<string, unknown>>;
  onRenderMarkdown?: (content: string) => string | Promise<string>;
  excerptGenerator?: (content: string, length: number) => string | Promise<string>;
  injectHead?: () => (string | ReactNode)[] | Promise<(string | ReactNode)[]>;
  injectFooter?: () => (string | ReactNode)[] | Promise<(string | ReactNode)[]>;
  onPageView?: (data: { path: string; ip: string; sessionId?: string }) => void | Promise<void>;
  searchProvider?: SearchProvider;

  // 主题端
  injectSidebarWidget?: () => SidebarWidgetDef[];
  injectPostContent?: () => ComponentType[];
  injectCommentWidget?: () => ComponentType | null;

  // 后台 Console UI
  dashboardWidget?: DashboardWidgetDef[];
  postListItemOperation?: ListItemOperationDef[];
  customAdminRoutes?: AdminRouteDef[];
  customFrontendRoutes?: FrontendRouteDef[];

  // 自定义 REST API
  customApi?: CustomApiRouteDef[];
}

export interface LoadedPlugin {
  slug: string;
  meta: PluginMeta;
  handlers: ExtensionHandlers;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface PluginMeta {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  entry?: string;
  permissions?: { name: string; displayName: string; group: string }[];
  roleTemplates?: {
    name: string;
    displayName: string;
    description?: string;
    dependsOn?: string[];
    permissions: string[];
  }[];
  database?: {
    enabled?: boolean;
    migrations?: { version: string; description?: string; file: string }[];
  };
  configSchema?: Record<string, unknown>;
}
