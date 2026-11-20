// app/api/console/settings/test-smtp/route.ts — SMTP 连接测试（仅管理员）
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { testSmtpConnection } from '@/lib/mailer';

export const runtime = 'nodejs';

export async function POST() {
  const check = await requirePermission('site:config');
  if (check) return check;

  const result = await testSmtpConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
