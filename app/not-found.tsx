import Link from 'next/link';
import { Home, CloudRain } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 anim-fade-in">
      <CloudRain className="w-16 h-16 text-primary anim-scale-in" strokeWidth={1.5} />
      <div className="text-center anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h1 className="text-5xl font-bold tracking-tight">404</h1>
        <p className="mt-3 text-fg-muted">页面被雨淋走了 找不到这个角落</p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-white text-sm font-medium transition-all duration-200 hover:bg-primary-hover active:scale-95 anim-fade-in-up"
        style={{ animationDelay: '0.2s' }}
      >
        <Home className="w-4 h-4" />
        回到首页
      </Link>
    </div>
  );
}
