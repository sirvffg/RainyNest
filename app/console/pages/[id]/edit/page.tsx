// app/console/pages/[id]/edit/page.tsx — 编辑独立页面：服务端校验登录并加载数据

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PageEditor from '@/components/admin/PageEditor';
import type { PageEditorInitial } from '@/components/admin/PageEditor';

export const metadata: Metadata = { title: '编辑页面' };

export default async function EditCustomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect(`/signin?redirect=/console/pages/${id}/edit`);

  let initial: PageEditorInitial | null = null;
  try {
    const h = await headers();
    const host = h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const res = await fetch(`${proto}://${host}/api/pages/${id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      initial = {
        title: data?.title ?? '',
        slug: data?.slug ?? '',
        summary: data?.summary ?? '',
        content: data?.content ?? '',
        status: data?.status ?? 'PUBLISHED',
        order: typeof data?.order === 'number' ? data.order : 0,
      };
    }
  } catch {
    initial = null;
  }

  return <PageEditor mode="edit" pageId={id} initial={initial} />;
}
