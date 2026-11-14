// lib/analytics.ts — 访问库 Client（独立 schema → 独立 Client）
// 从 analytics.prisma 配置的 output 目录 import
import { PrismaClient as AnalyticsPrismaClient } from '../generated/prisma/analytics';

const globalForAnalytics = globalThis as unknown as { analytics?: AnalyticsPrismaClient };

export const analytics =
  globalForAnalytics.analytics || new AnalyticsPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForAnalytics.analytics = analytics;
}
