// app/(site)/profile/page.tsx — 个人页面（需登录）
import type { Metadata } from 'next';
import ProfileForm from './ProfileForm';

export const metadata: Metadata = {
  title: '个人页面',
  robots: { index: false },
};

export default function ProfilePage() {
  return <ProfileForm />;
}
