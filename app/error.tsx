'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-6 px-4">
      <TriangleAlert className="w-14 h-14 text-red-500 anim-scale-in" strokeWidth={1.5} />
      <div className="text-center anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-2xl font-bold">出错了</h2>
        <p className="mt-2 text-sm text-fg-muted break-all max-w-md">{error.message}</p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-white text-sm font-medium transition-all duration-200 hover:bg-primary-hover active:scale-95 anim-fade-in-up"
        style={{ animationDelay: '0.2s' }}
      >
        <RefreshCw className="w-4 h-4" />
        重试
      </button>
    </div>
  );
}
