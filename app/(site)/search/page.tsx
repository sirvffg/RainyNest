// app/search/page.tsx — 搜索页（FTS5 默认引擎，插件可替换）
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getSearchProvider } from '@/lib/search/default-provider';
import { resolveSystemTemplate, type SearchTemplateProps } from '@/lib/theme/templates';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || '').trim();

  let results: { id: string; title: string; slug: string; summary: string | null; snippet: string }[] = [];
  if (query) {
    try {
      const provider = await getSearchProvider();
      results = await provider.search(query, { limit: 20 });
    } catch { /* 静默 */ }
  }

  // 搜索表单提取为变量，默认分支与主题模板共用
  const formNode = (
    <form action="/search" method="GET" className="mt-6 flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={query}
        placeholder="输入关键词..."
        className="flex-1 px-4 py-2.5 rounded border border-line bg-bg text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        className="px-5 py-2.5 rounded bg-primary text-white text-sm font-medium transition-all duration-200 hover:bg-primary-hover active:scale-95"
      >
        搜索
      </button>
    </form>
  );

  let Override: Awaited<ReturnType<typeof resolveSystemTemplate<SearchTemplateProps>>> = null;
  try {
    Override = await resolveSystemTemplate<SearchTemplateProps>('search');
  } catch (err) {
    console.error('[Theme] search 模板加载失败，回退内置模板:', err);
  }

  if (Override) {
    const Template = Override.default;
    return <Template query={query} results={results} slots={{ form: formNode }} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <Search className="w-7 h-7 text-primary" />
          搜索
        </h1>
        {formNode}
      </header>

      {query && (
        <section className="space-y-4">
          <p className="text-sm text-fg-muted anim-fade-in">
            {results.length > 0 ? `找到 ${results.length} 条与「${query}」相关的结果` : `没有找到与「${query}」相关的内容`}
          </p>
          <div className="space-y-3">
            {results.map((r, i) => (
              <Link
                key={r.id}
                href={`/blog/${r.slug}`}
                className="block rounded-lg border border-line p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 anim-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
              >
                <h2 className="font-semibold hover:text-primary transition-colors">{r.title}</h2>
                <p
                  className="mt-2 text-sm text-fg-muted line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: r.snippet || r.summary || '' }}
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
