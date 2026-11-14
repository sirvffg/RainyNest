// app/console/pages/new/page.tsx — 新建独立页面

import type { Metadata } from 'next';
import PageEditor from '@/components/admin/PageEditor';

export const metadata: Metadata = { title: '新建页面' };

export default function NewCustomPage() {
  return <PageEditor mode="create" />;
}
