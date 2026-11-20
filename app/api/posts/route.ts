// app/api/posts/route.ts — 文章列表 / 创建
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireSession, requirePermission, slugify } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { renderMarkdown } from '@/lib/markdown/processor';
import { fireExtensionPoint, firstWins } from '@/lib/plugin/engine';
import { pluginApiGate } from '@/lib/plugin/api-gate';
import type { Prisma } from '@prisma/client';

// 列表查询
export async function GET(req: NextRequest) {
  const blocked = await pluginApiGate(req);
  if (blocked) return blocked;
  const session = await requireSession();
  const sp = req.nextUrl.searchParams;
  const keyword = sp.get('keyword')?.trim() || '';
  const status = sp.get('status') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(sp.get('size') || '10', 10) || 10));

  // 未登录只能看已发布；登录后可按 status 筛选（含草稿）
  return listPosts({ keyword, status: session ? status : 'PUBLISHED', page, size });
}

async function listPosts(opts: { keyword: string; status: string; page: number; size: number }) {
  const where: Prisma.PostWhereInput = {};
  if (opts.status && opts.status !== 'ALL') where.status = opts.status;
  if (opts.keyword) {
    where.OR = [
      { title: { contains: opts.keyword } },
      { content: { contains: opts.keyword } },
      { summary: { contains: opts.keyword } },
    ];
  }

  const [total, list] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      include: {
        category: true,
        tags: { include: { tag: true } },
        author: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
      orderBy: [{ isTop: 'desc' }, { createdAt: 'desc' }],
      skip: (opts.page - 1) * opts.size,
      take: opts.size,
    }),
  ]);

  // 插件扩展点：postListItemOperation（行操作按钮，降级为链接型 href 模板）
  let operations: unknown[] = [];
  let fields: { key: string; label: string; width?: number; sortable?: boolean }[] = [];
  let rows: unknown[] = list;
  try {
    const { collectPostOperations, collectListFields, renderListFieldValues } = await import('@/lib/plugin/ui');
    operations = await collectPostOperations();
    const defs = await collectListFields('postListItemField');
    fields = defs.map(({ key, label, width, sortable }) => ({ key, label, width, sortable }));
    if (defs.length > 0) {
      rows = await Promise.all(
        list.map(async (post) => ({
          ...post,
          // 插件列表字段的渲染结果（扁平化标签结构，便于插件读取）
          _fields: await renderListFieldValues(defs, {
            ...post,
            tags: post.tags?.map((t) => t.tag) ?? [],
          }),
        }))
      );
    }
  } catch { /* 插件系统未就绪 */ }

  return NextResponse.json({ list: rows, total, operations, fields });
}

// 创建文章
const postSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  slug: z.string().min(1, 'Slug 不能为空').max(200),
  summary: z.string().max(1000).optional().nullable(),
  content: z.string().min(1, '内容不能为空'),
  coverImage: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional(),
  isTop: z.boolean().optional(),
  allowComment: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string().min(1)).optional(),
});

// 按名字 upsert 标签，返回 tagId
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
      // slug 冲突 → 加随机后缀重试
      slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const created = await db.tag.create({ data: { name: trimmed, slug } });
      ids.push(created.id);
    }
  }
  return ids;
}

export async function POST(req: NextRequest) {
  const blocked = await pluginApiGate(req);
  if (blocked) return blocked;
  const check = await requirePermission('post:create');
  if (check) return check;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }
  const input = parsed.data;

  // 构造 data，先跑插件扩展点（插件可写 meta.patch 覆盖字段）
  let html: string | null = null;
  try {
    html = await renderMarkdown(input.content);
  } catch {
    html = null;
  }

  const data: Record<string, unknown> = {
    authorId: session.user.id,
    title: input.title,
    slug: input.slug,
    summary: input.summary ?? null,
    content: input.content,
    html,
    coverImage: input.coverImage ?? null,
    status: input.status ?? 'DRAFT',
    isTop: input.isTop ?? false,
    allowComment: input.allowComment ?? true,
    categoryId: input.categoryId ?? null,
    words: input.content.length,
    publishedAt: (input.status ?? 'DRAFT') === 'PUBLISHED' ? new Date() : null,
  };

  const meta = { patch: {} as Record<string, unknown> };
  try {
    await fireExtensionPoint('beforeSavePost', data, meta);
  } catch { /* 插件失败不阻塞保存 */ }
  for (const [k, v] of Object.entries(meta.patch || {})) {
    if (v !== undefined) data[k] = v;
  }

  // 摘要生成扩展点：未填摘要时让插件生成（首个生效，兜底截取纯文本前 160 字）
  if (!data.summary) {
    try {
      const excerpt = await firstWins('excerptGenerator', input.content, 160);
      if (typeof excerpt === 'string' && excerpt.trim()) data.summary = excerpt.trim();
    } catch { /* 插件系统未就绪 */ }
  }

  const tagIds = input.tags && input.tags.length > 0 ? await upsertTags(input.tags) : [];

  try {
    const post = await db.post.create({
      data: {
        ...(data as unknown as Prisma.PostUncheckedCreateInput),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: { tags: { include: { tag: true } }, category: true },
    });
    // 插件扩展点：保存成功后（发通知/推送等，失败不阻塞）
    try {
      await fireExtensionPoint('afterSavePost', post as unknown as Record<string, unknown>);
    } catch { /* ignore */ }
    revalidatePath('/', 'layout');
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Slug 已存在，请更换' }, { status: 400 });
    }
    console.error('[api/posts] create failed:', err);
    return NextResponse.json({ error: '创建文章失败' }, { status: 500 });
  }
}
