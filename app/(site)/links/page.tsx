// app/links/page.tsx — 友链墙
import { Globe, ArrowUpRight, Link2 } from 'lucide-react';
import { db } from '@/lib/prisma';

export const revalidate = 3600;

export default async function LinksPage() {
  let links: {
    id: string; name: string; url: string; logo: string | null; description: string | null;
  }[] = [];
  try {
    links = await db.link.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { order: 'asc' },
    });
  } catch { /* 数据库未就绪 */ }

  return (
    <div>
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <Link2 className="w-7 h-7 text-primary" />
          友情链接
        </h1>
        <p className="mt-2 text-fg-muted text-sm">共 {links.length} 个站点</p>
      </header>

      {links.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          还没有友链
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-lg border border-line bg-bg p-4 transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
            >
              {link.logo ? (
                <img
                  src={link.logo}
                  alt={link.name}
                  loading="lazy"
                  className="w-10 h-10 rounded object-cover shrink-0 transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-bg-secondary text-fg-muted transition-colors duration-200 group-hover:text-primary">
                  <Globe className="w-5 h-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="inline-flex items-center gap-1 font-semibold group-hover:text-primary transition-colors duration-200">
                  <span className="truncate">{link.name}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
                </h2>
                {link.description && (
                  <p className="mt-1 text-sm text-fg-muted line-clamp-2 leading-relaxed">
                    {link.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
