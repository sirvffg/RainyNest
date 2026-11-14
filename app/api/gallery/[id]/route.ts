// app/api/gallery/[id]/route.ts — 相册详情 / 更新（照片整体替换） / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const gallery = await db.gallery.findUnique({
    where: { id },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
  });
  if (!gallery) return NextResponse.json({ error: '相册不存在' }, { status: 404 });
  return NextResponse.json(gallery);
}

const photoSchema = z.object({
  url: z.string().min(1),
  title: z.string().optional().nullable(),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
});

const putSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  coverImage: z.string().optional().nullable(),
  status: z.enum(['PUBLISHED', 'HIDDEN']).optional(),
  photos: z.array(photoSchema).optional(),
});

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('gallery:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.gallery.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '相册不存在' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }

  const { photos, ...fields } = parsed.data;

  try {
    const gallery = await db.$transaction(async (tx) => {
      const updated = await tx.gallery.update({ where: { id }, data: fields });
      // 照片整体替换：先删后建
      if (photos !== undefined) {
        await tx.photo.deleteMany({ where: { galleryId: id } });
        if (photos.length > 0) {
          await tx.photo.createMany({
            data: photos.map((p) => ({
              galleryId: id,
              url: p.url,
              title: p.title ?? null,
              width: p.width ?? null,
              height: p.height ?? null,
            })),
          });
        }
      }
      return updated;
    });
    revalidatePath('/', 'layout');
    return NextResponse.json(gallery);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Slug 已存在，请更换' }, { status: 400 });
    }
    console.error('[api/gallery/id] update failed:', err);
    return NextResponse.json({ error: '更新相册失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('gallery:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.gallery.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '相册不存在' }, { status: 404 });

  await db.gallery.delete({ where: { id } }); // photos 级联删除
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
