// app/api/upload/route.ts — 附件上传（插件 attachmentStorage 优先，默认落 public/uploads/{yyyyMM}/）
import { NextResponse, NextRequest } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { getAttachmentStorageProvider } from '@/lib/plugin/engine';
import { normalizeImage } from '@/lib/image';

export const runtime = 'nodejs';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const check = await requirePermission('photo:upload');
  if (check) return check;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '请求必须是 multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 file 字段' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件超过 10MB 上限' }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: '仅支持 jpg / png / gif / webp / svg 图片' }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  // 可选：按 EXIF 方向校正（sharp 不可用时原样返回）
  const { buffer } = await normalizeImage(rawBuffer);
  const session = await auth();

  // ⭐ 插件附件存储优先（七牛 / OSS / S3 等）
  let url = '';
  let storage = 'local';
  try {
    const provider = await getAttachmentStorageProvider();
    if (provider) {
      const result = await provider.upload({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        buffer,
      });
      if (result?.url) {
        url = result.url;
        storage = provider.name;
      }
    }
  } catch (err) {
    console.error('[upload] attachmentStorage provider failed:', err);
  }

  // 默认本地存储
  if (!url) {
    const now = new Date();
    const folder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const id = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${id}.${ext}`;
    const dir = path.join(process.cwd(), 'public', 'uploads', folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    url = `/uploads/${folder}/${filename}`;
  }

  // 附件库记录（失败不影响上传结果）
  try {
    await db.attachment.create({
      data: {
        name: file.name || `upload.${ext}`,
        url,
        mimeType: file.type,
        size: file.size,
        storage,
        uploaderId: session?.user?.id ?? null,
      },
    });
  } catch { /* 数据库未就绪 */ }

  // 附件库页面缓存失效
  revalidatePath('/console/attachments');

  return NextResponse.json({ url, storage }, { status: 201 });
}
