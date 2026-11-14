// app/api/gallery/route.ts — 相册列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';

// 列表（含照片数量；未登录只看已发布）
export async function GET() {
  const session = await requireSession();
  const list = await db.gallery.findMany({
    where: session ? {} : { status: 'PUBLISHED' },
    include: { _count: { select: { photos: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    list: list.map(({ _count, ...g }) => ({ ...g, photoCount: _count.photos })),
  });
}

const createSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  slug: z.string().min(1, 'Slug 不能为空').max(200),
  description: z.string().max(1000).optional().nullable(),
  coverImage: z.string().optional().nullable(),
  status: z.enum(['PUBLISHED', 'HIDDEN']).optional(),
  photos: z
    .array(
      z.object({
        url: z.string().min(1),
        title: z.string().optional().nullable(),
        width: z.number().int().optional().nullable(),
        height: z.number().int().optional().nullable(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  const check = await requirePermission('gallery:create');
  if (check) return check;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }

  const { photos, ...fields } = parsed.data;

  try {
    const gallery = await db.gallery.create({
      data: {
        ...fields,
        photos: { create: (photos || []).map((p) => ({ url: p.url, title: p.title ?? null, width: p.width ?? null, height: p.height ?? null })) },
      },
      include: { photos: true },
    });
    revalidatePath('/', 'layout');
    return NextResponse.json(gallery, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Slug 已存在，请更换' }, { status: 400 });
    }
    console.error('[api/gallery] create failed:', err);
    return NextResponse.json({ error: '创建相册失败' }, { status: 500 });
  }
}
