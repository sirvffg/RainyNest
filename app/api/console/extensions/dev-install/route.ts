// app/api/console/extensions/dev-install/route.ts — dev 临时安装接口（CLI ext dev 热更新用）
// 鉴权：管理后台 session，或请求头 x-ext-token === EXT_DEV_TOKEN（.env 配置，仅开发联调用）
// 入参：multipart/form-data，字段 file = 发布包（*.zip.rainy-plugin 或 *.gz.rainy-theme）
// dev 模式：跳过版本校验与 DB 记录，仅落盘 + 热重载
import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/api-auth';
import { installFromBuffer, MAX_PACKAGE_SIZE } from '@/lib/ext-installer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // 鉴权：dev token 优先，其次管理后台 session（含 * 权限）
  const token = req.headers.get('x-ext-token');
  const expected = process.env.EXT_DEV_TOKEN;
  let authorized = false;
  if (expected && token && token === expected) {
    authorized = true;
  } else {
    const session = await auth();
    authorized = hasPermission(session, 'plugin:install') || hasPermission(session, '*');
  }
  if (!authorized) {
    return NextResponse.json({ error: '未授权（需要管理员 session 或 x-ext-token）' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '请求体不是合法的 multipart 表单' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 file 字段' }, { status: 400 });
  }
  if (file.size > MAX_PACKAGE_SIZE) {
    return NextResponse.json({ error: `包体积超过 ${MAX_PACKAGE_SIZE / 1024 / 1024}MB 上限` }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await installFromBuffer(buffer, file.name || '', { dev: true });
    return NextResponse.json({ ok: true, kind: result.kind, slug: result.slug, version: result.version });
  } catch (err) {
    console.error('[api/console/extensions/dev-install] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '安装失败' }, { status: 400 });
  }
}
