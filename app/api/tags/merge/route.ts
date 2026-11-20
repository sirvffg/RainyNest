// app/api/tags/merge/route.ts — 合并标签（把 source 的关联迁到 target 后删除 source）
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';

const mergeSchema = z.object({
  sourceId: z.string().min(1, '缺少来源标签'),
  targetId: z.string().min(1, '缺少目标标签'),
});

export async function POST(req: NextRequest) {
  // 合并涉及更新关联并删除标签，使用现有 tag:update 权限
  const check = await requirePermission('tag:update');
  if (check) return check;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }

  const { sourceId, targetId } = parsed.data;
  if (sourceId === targetId) {
    return NextResponse.json({ error: '来源标签与目标标签不能相同' }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    db.tag.findUnique({ where: { id: sourceId }, select: { id: true, name: true } }),
    db.tag.findUnique({ where: { id: targetId }, select: { id: true, name: true } }),
  ]);
  if (!source) return NextResponse.json({ error: '来源标签不存在' }, { status: 404 });
  if (!target) return NextResponse.json({ error: '目标标签不存在' }, { status: 404 });

  const links = await db.postTag.findMany({
    where: { tagId: sourceId },
    select: { postId: true },
  });

  try {
    // SQLite 不支持 createMany skipDuplicates，用 upsert 保证不重复关联
    await db.$transaction([
      ...links.map((link) =>
        db.postTag.upsert({
          where: { postId_tagId: { postId: link.postId, tagId: targetId } },
          create: { postId: link.postId, tagId: targetId },
          update: {},
        })
      ),
      db.postTag.deleteMany({ where: { tagId: sourceId } }),
      db.tag.delete({ where: { id: sourceId } }),
    ]);
  } catch (err) {
    console.error('[api/tags/merge] failed:', err);
    return NextResponse.json({ error: '合并失败 请稍后重试' }, { status: 500 });
  }

  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, moved: links.length, source: source.name, target: target.name });
}
