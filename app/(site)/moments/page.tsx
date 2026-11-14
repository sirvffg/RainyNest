// app/moments/page.tsx — 说说时间流（卡片式时间轴）
import { CloudRain } from 'lucide-react';
import { db } from '@/lib/prisma';
import MomentCard, { type MomentCardData } from '@/components/moments/MomentCard';

export const revalidate = 3600;

export default async function MomentsPage() {
  let moments: MomentCardData[] = [];
  try {
    moments = await db.moment.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { displayName: true, avatar: true } } },
    });
  } catch { /* 数据库未就绪 */ }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <CloudRain className="w-7 h-7 text-primary" />
          说说
        </h1>
        <p className="mt-2 text-fg-muted text-sm">共 {moments.length} 条动态</p>
      </header>

      {moments.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-line p-12 text-center text-fg-muted anim-fade-in">
          还没有说说
        </div>
      ) : (
        <div className="relative mt-8 ml-2 md:ml-3 border-l-2 border-line">
          {moments.map((moment, i) => (
            <div key={moment.id} className="relative pl-5 md:pl-7 pb-6 last:pb-0">
              {/* 时间轴圆点 */}
              <span className="absolute -left-[6px] top-7 w-2.5 h-2.5 rounded-full border-2 border-primary bg-bg transition-all duration-300 hover:scale-125" />
              <MomentCard moment={moment} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
