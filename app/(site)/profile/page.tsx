// app/(site)/profile/page.tsx — 个人页面（需登录，始终动态）
import type { Metadata } from 'next';
import ProfileForm from './ProfileForm';

// 登录态区域不做缓存
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '个人页面',
  robots: { index: false },
};

export default function ProfilePage() {
  return <ProfileForm />;
}
