// app/moments/page.tsx — 说说时间流（卡片式时间轴）
import { CloudRain } from 'lucide-react';
import { db } from '@/lib/prisma';
import MomentCard, { type MomentCardData } from '@/components/moments/MomentCard';
import {
  resolveSystemTemplate,
  type MomentsTemplateProps,
  type TemplateMoment,
} from '@/lib/theme/templates';

export const revalidate = 300;

// 与 MomentCard 保持一致的图片解析（只接受非空字符串数组）
function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch {
    return [];
  }
}

export default async function MomentsPage() {
  let moments: MomentCardData[] = [];
  try {
    moments = await db.moment.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { displayName: true, avatar: true } } },
    });
  } catch { /* 数据库未就绪 */ }

  // 时间轴容器提取为变量，默认分支与主题模板共用
  const listNode =
    moments.length === 0 ? (
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
    );

  let Override: Awaited<ReturnType<typeof resolveSystemTemplate<MomentsTemplateProps>>> = null;
  try {
    Override = await resolveSystemTemplate<MomentsTemplateProps>('moments');
  } catch (err) {
    console.error('[Theme] moments 模板加载失败，回退内置模板:', err);
  }

  if (Override) {
    const Template = Override.default;
    const templateMoments: TemplateMoment[] = moments.map((moment) => ({
      id: moment.id,
      content: moment.content,
      images: parseImages(moment.images),
      createdAt: moment.createdAt,
      user: moment.user,
    }));
    return <Template moments={templateMoments} slots={{ list: listNode }} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="anim-fade-in-up">
        <h1 className="text-3xl font-bold inline-flex items-center gap-3">
          <CloudRain className="w-7 h-7 text-primary" />
          说说
        </h1>
        <p className="mt-2 text-fg-muted text-sm">共 {moments.length} 条动态</p>
      </header>

      {listNode}
    </div>
  );
}
