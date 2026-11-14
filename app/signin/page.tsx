import { Suspense } from 'react';
import SignInForm from './SignInForm';

export const metadata = { title: '登录' };

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
