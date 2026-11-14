// app/console/posts/[id]/edit/page.tsx — 编辑文章：服务端校验登录并加载文章数据

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PostEditor from '@/components/admin/PostEditor';
import type { PostEditorInitial } from '@/components/admin/PostEditor';

export const metadata: Metadata = { title: '编辑文章' };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect(`/signin?redirect=/console/posts/${id}/edit`);

  let initial: PostEditorInitial | null = null;
  try {
    const h = await headers();
    const host = h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const res = await fetch(`${proto}://${host}/api/posts/${id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      initial = {
        title: data?.title ?? '',
        slug: data?.slug ?? '',
        summary: data?.summary ?? '',
        content: data?.content ?? '',
        coverImage: data?.coverImage ?? '',
        status: data?.status ?? 'DRAFT',
        isTop: Boolean(data?.isTop),
        allowComment: data?.allowComment ?? true,
        categoryId: data?.categoryId ?? null,
        tags: Array.isArray(data?.tags)
          ? data.tags.map((t: { name?: string }) => t?.name ?? '').filter(Boolean)
          : [],
      };
    }
  } catch {
    initial = null;
  }

  return <PostEditor mode="edit" postId={id} initial={initial} />;
}
