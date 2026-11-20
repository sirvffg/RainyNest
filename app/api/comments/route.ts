// app/api/comments/route.ts — 评论列表 / 发表评论
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireSession, requirePermission } from '@/lib/api-auth';
import { db } from '@/lib/prisma';
import { getSiteSetting } from '@/lib/site';
import { fireExtensionPoint } from '@/lib/plugin/engine';
import { mailScenes, sendMail } from '@/lib/mailer';
import { pluginApiGate } from '@/lib/plugin/api-gate';

// 评论列表：带 postId 时公开（仅返回 APPROVED 树）；否则为后台管理列表（登录即可，支持 status/page/size）
export async function GET(req: NextRequest) {
  const blocked = await pluginApiGate(req);
  if (blocked) return blocked;
  const sp = req.nextUrl.searchParams;
  const postId = sp.get('postId') || '';

  if (postId) {
    const list = await db.comment.findMany({
      where: { postId, status: 'APPROVED' },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    // 组装两级树
    const top = list
      .filter((c) => !c.parentId)
      .map((c) => ({ ...c, replies: list.filter((r) => r.parentId === c.id) }));
    return NextResponse.json({ list: top, total: list.length });
  }

  const session = await requireSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const status = sp.get('status') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(sp.get('size') || '20', 10) || 20));

  const where = status && status !== 'ALL' ? { status } : {};

  const [total, list] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      include: {
        post: { select: { id: true, title: true, slug: true } },
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        parent: { include: { user: { select: { id: true, displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);
  // 插件扩展点：评论/回复行操作
  let operations: unknown[] = [];
  let replyOperations: unknown[] = [];
  let rows: unknown[] = list;
  try {
    const { collectListOperations, collectCommentSubjectRefs } = await import('@/lib/plugin/ui');
    [operations, replyOperations] = await Promise.all([
      collectListOperations('commentListItemOperation'),
      collectListOperations('replyListItemOperation'),
    ]);
    // commentSubjectRef：评论来源展示（第一个提供者生效）
    const refs = await collectCommentSubjectRefs();
    const ref = refs[0];
    if (ref) {
      rows = list.map((c) => {
        try {
          return { ...c, _subject: { key: ref.key, label: ref.label, href: ref.href(c) } };
        } catch {
          return c;
        }
      });
    }
  } catch { /* 插件系统未就绪 */ }

  return NextResponse.json({ list: rows, total, operations, replyOperations });
}

// 发表评论（公开给已登录用户，无需后台权限）
const createSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1, '评论内容不能为空').max(2000),
  parentId: z.string().optional().nullable(),
  // 插件 injectCommentField 注入的结构化字段
  extra: z.record(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const blocked = await pluginApiGate(req);
  if (blocked) return blocked;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录后再评论' }, { status: 401 });
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
  const { postId, content, parentId, extra } = parsed.data;

  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true, allowComment: true, status: true } });
  if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  if (!post.allowComment) return NextResponse.json({ error: '该文章已关闭评论' }, { status: 403 });
  if (parentId) {
    const parent = await db.comment.findUnique({ where: { id: parentId }, select: { id: true, postId: true } });
    if (!parent || parent.postId !== postId) {
      return NextResponse.json({ error: '回复的评论不存在' }, { status: 400 });
    }
  }

  // 初始状态由站点「评论审核」开关决定
  const site = await getSiteSetting();
  let status: 'PENDING' | 'APPROVED' | 'REJECTED' = site.commentModeration ? 'PENDING' : 'APPROVED';

  // 插件扩展点：可覆盖审核状态
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || '';
  try {
    const results = await fireExtensionPoint('beforeCommentApprove', {
      postId,
      userId: session.user.id,
      content,
      parentId: parentId ?? null,
      ip,
      userAgent,
    });
    const first = results[0];
    if (first === 'APPROVED' || first === 'REJECTED' || first === 'PENDING') {
      status = first;
    }
  } catch { /* 插件失败不影响创建 */ }

  const comment = await db.comment.create({
    data: {
      postId,
      userId: session.user.id,
      content,
      parentId: parentId ?? null,
      status,
      ip,
      userAgent,
      extra: extra ? JSON.stringify(extra) : null,
    },
    include: {
      post: { select: { id: true, title: true, slug: true } },
      user: { select: { id: true, username: true, displayName: true, email: true } },
    },
  });
  revalidatePath('/', 'layout');

  // 邮件通知管理员（fire-and-forget，SMTP 未配置时 sendMail 内部静默跳过）
  const commenterName = comment.user.displayName || comment.user.username;
  void (status === 'PENDING'
    ? mailScenes.newCommentPending(comment.post.title, commenterName, comment.content)
    : sendMail(site.email || '', {
        subject: `新评论通知 - ${comment.post.title}`,
        html: `<p><strong>${commenterName}</strong> 在 <em>${comment.post.title}</em> 下发表了新评论：</p><blockquote>${comment.content}</blockquote>`,
      })
  ).catch(() => {});

  return NextResponse.json(comment, { status: 201 });
}
