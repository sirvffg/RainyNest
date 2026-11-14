// app/api/console/themes/install/route.ts — 上传安装/升级主题（仅管理员）
// multipart 上传 *.gz.rainy-theme / *.zip.rainy-theme，落盘 scripts/themes/<slug>/ 并同步静态资源
import { NextResponse, NextRequest } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { installFromBuffer, MAX_PACKAGE_SIZE } from '@/lib/ext-installer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const check = await requirePermission('theme:install');
  if (check) return check;

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
    const result = await installFromBuffer(buffer, file.name || '');
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api/console/themes/install] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '安装失败' }, { status: 400 });
  }
}
