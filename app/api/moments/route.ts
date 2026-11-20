// app/api/moments/route.ts — 说说列表 / 发布
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireSession, requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { pluginApiGate } from '@/lib/plugin/api-gate';

// 列表（未登录只看已发布；登录可看全部，支持 ?status= 筛选）
export async function GET(req: NextRequest) {
  const blocked = await pluginApiGate(req);
  if (blocked) return blocked;
  const session = await requireSession();
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(sp.get('size') || '20', 10) || 20));

  const where = session && status && status !== 'ALL' ? { status } : session ? {} : { status: 'PUBLISHED' };

  const [total, list] = await Promise.all([
    db.moment.count({ where }),
    db.moment.findMany({
      where,
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);
  return NextResponse.json({ list, total });
}

// 发布说说（登录 + moment:create 权限）
const createSchema = z.object({
  content: z.string().min(1, '内容不能为空').max(5000),
  images: z.array(z.string()).max(9).optional(),
});

export async function POST(req: NextRequest) {
  const blocked = await pluginApiGate(req);
  if (blocked) return blocked;
  const check = await requirePermission('moment:create');
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '参数校验失败' }, { status: 400 });
  }

  const moment = await db.moment.create({
    data: {
      userId: session.user.id,
      content: parsed.data.content,
      images: parsed.data.images ? JSON.stringify(parsed.data.images) : null,
    },
    include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
  });
  revalidatePath('/', 'layout');
  return NextResponse.json(moment, { status: 201 });
}
