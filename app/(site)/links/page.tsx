// app/links/page.tsx — 友链墙
import { Link2 } from 'lucide-react';
import { db } from '@/lib/prisma';
import LinkCard, { type LinkCardData } from '@/components/link/LinkCard';

export const revalidate = 300;

export default async function LinksPage() {
  let links: LinkCardData[] = [];
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
            <LinkCard key={link.id} link={link} />
          ))}
        </div>
      )}
    </div>
  );
}
