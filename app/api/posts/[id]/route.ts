// app/api/posts/[id]/route.ts — 文章详情 / 更新 / 删除
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireSession, requirePermission, slugify } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { renderMarkdown } from '@/lib/markdown/processor';
import { fireExtensionPoint } from '@/lib/plugin/engine';
import type { Prisma } from '@prisma/client';

type Ctx = { params: Promise<{ id: string }> };

// 详情（含 tags/category/author）；未登录时仅返回已发布文章
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const session = await requireSession();

  const post = await db.post.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      category: true,
      author: { select: { id: true, username: true, displayName: true, avatar: true } },
    },
  });
  if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  if (!session && post.status !== 'PUBLISHED') {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  }
  return NextResponse.json(post);
}

// 更新
const putSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  summary: z.string().max(1000).optional().nullable(),
  content: z.string().min(1).optional(),
  coverImage: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional(),
  isTop: z.boolean().optional(),
  allowComment: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string().min(1)).optional(),
});

async function upsertTags(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const existing = await db.tag.findUnique({ where: { name: trimmed } });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    let slug = slugify(trimmed);
    try {
      const created = await db.tag.create({ data: { name: trimmed, slug } });
      ids.push(created.id);
    } catch {
      slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const created = await db.tag.create({ data: { name: trimmed, slug } });
      ids.push(created.id);
    }
  }
  return ids;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('post:update');
  if (check) return check;

  const { id } = await params;
  const existing = await db.post.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '文章不存在' }, { status: 404 });

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
  const input = parsed.data;

  // 重算 html / words / publishedAt
  const content = input.content ?? existing.content;
  let html: string | null = existing.html;
  if (input.content !== undefined) {
    try {
      html = await renderMarkdown(content);
    } catch {
      html = null;
    }
  }

  const nextStatus = input.status ?? existing.status;
  let publishedAt = existing.publishedAt;
  if (nextStatus === 'PUBLISHED' && !publishedAt) publishedAt = new Date();
  if (nextStatus !== 'PUBLISHED') publishedAt = existing.status === 'PUBLISHED' ? existing.publishedAt : null;

  const data: Record<string, unknown> = {
    title: input.title ?? existing.title,
    slug: input.slug ?? existing.slug,
    summary: input.summary !== undefined ? input.summary : existing.summary,
    content,
    html,
    coverImage: input.coverImage !== undefined ? input.coverImage : existing.coverImage,
    status: nextStatus,
    isTop: input.isTop ?? existing.isTop,
    allowComment: input.allowComment ?? existing.allowComment,
    categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
    words: content.length,
    publishedAt,
  };

  // 插件扩展点
  const meta = { patch: {} as Record<string, unknown> };
  try {
    await fireExtensionPoint('beforeSavePost', data, meta);
  } catch { /* 插件失败不阻塞保存 */ }
  for (const [k, v] of Object.entries(meta.patch || {})) {
    if (v !== undefined) data[k] = v;
  }

  // 摘要生成扩展点：仍无摘要且内容有更新时让插件生成
  if (!data.summary) {
    try {
      const { firstWins } = await import('@/lib/plugin/engine');
      const excerpt = await firstWins('excerptGenerator', content, 160);
      if (typeof excerpt === 'string' && excerpt.trim()) data.summary = excerpt.trim();
    } catch { /* ignore */ }
  }

  try {
    const post = await db.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data: data as unknown as Prisma.PostUncheckedUpdateInput,
      });
      // 标签整体替换
      if (input.tags !== undefined) {
        await tx.postTag.deleteMany({ where: { postId: id } });
        const tagIds = await upsertTags(input.tags);
        if (tagIds.length > 0) {
          await tx.postTag.createMany({ data: tagIds.map((tagId) => ({ postId: id, tagId })) });
        }
      }
      return updated;
    });
    // 插件扩展点：保存成功后（发通知/推送等，失败不阻塞）
    try {
      await fireExtensionPoint('afterSavePost', post as unknown as Record<string, unknown>);
    } catch { /* ignore */ }
    revalidatePath('/', 'layout');
    return NextResponse.json(post);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Slug 已存在，请更换' }, { status: 400 });
    }
    console.error('[api/posts/id] update failed:', err);
    return NextResponse.json({ error: '更新文章失败' }, { status: 500 });
  }
}

// 删除（PostTag 由 onDelete: Cascade 级联删除）
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const check = await requirePermission('post:delete');
  if (check) return check;

  const { id } = await params;
  const existing = await db.post.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: '文章不存在' }, { status: 404 });

  try {
    await fireExtensionPoint('beforeDeletePost', id);
  } catch { /* 插件失败不阻塞删除 */ }

  await db.post.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
