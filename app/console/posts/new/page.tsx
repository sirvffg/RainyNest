// app/console/posts/new/page.tsx — 新建文章

import type { Metadata } from 'next';
import PostEditor from '@/components/admin/PostEditor';

export const metadata: Metadata = { title: '新建文章' };

export default function NewPostPage() {
  return <PostEditor mode="create" />;
}
