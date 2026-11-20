// app/(site)/moments/[id]/page.tsx — 说说详情（图片预览 + 上一篇/下一篇）
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, CloudRain, User } from 'lucide-react';
import { db } from '@/lib/prisma';
import PhotoLightbox from '@/components/gallery/PhotoLightbox';

export const revalidate = 600;

interface Props {
  params: Promise<{ id: string }>;
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const moment = await db.moment.findUnique({ where: { id } });
    if (!moment) return { title: '说说不存在' };
    return {
      title: moment.content.slice(0, 50),
      description: moment.content.slice(0, 120),
    };
  } catch {
    return { title: '说说' };
  }
}

export default async function MomentDetailPage({ params }: Props) {
  const { id } = await params;

  let moment: {
    id: string;
    content: string;
    images: string | null;
    createdAt: Date;
    status: string;
    user: { displayName: string; avatar: string | null };
  } | null = null;
  try {
    moment = await db.moment.findUnique({
      where: { id },
      include: { user: { select: { displayName: true, avatar: true } } },
    });
  } catch { /* 数据库未就绪 */ }

  if (!moment || moment.status !== 'PUBLISHED') notFound();

  // 上一篇 / 下一篇（同状态内按创建时间）
  let prev: { id: string; content: string } | null = null;
  let next: { id: string; content: string } | null = null;
  try {
    [prev, next] = await Promise.all([
      db.moment.findFirst({
        where: { status: 'PUBLISHED', createdAt: { lt: moment.createdAt } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, content: true },
      }),
      db.moment.findFirst({
        where: { status: 'PUBLISHED', createdAt: { gt: moment.createdAt } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, content: true },
      }),
    ]);
  } catch { /* 忽略 */ }

  const images = parseImages(moment.images);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/moments"
        className="inline-flex items-center gap-1 text-sm text-fg-muted transition-all duration-200 hover:text-primary active:scale-95"
      >
        <ArrowLeft className="w-4 h-4" />
        返回说说列表
      </Link>

      <article className="mt-4 anim-fade-in-up rounded-lg border border-line bg-bg p-5 md:p-6">
        {/* 作者 */}
        <div className="flex items-center gap-3">
          {moment.user.avatar ? (
            <img
              src={moment.user.avatar}
              alt={moment.user.displayName}
              loading="lazy"
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-bg-secondary text-fg-muted">
              <User className="w-4 h-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{moment.user.displayName}</p>
            <time dateTime={moment.createdAt.toISOString()} className="text-xs text-fg-muted">
              {moment.createdAt.toLocaleString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        </div>

        {/* 正文 */}
        <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {moment.content}
        </p>

        {/* 图片预览 */}
        {images.length > 0 && (
          <PhotoLightbox photos={images.map((url) => ({ url }))} className="mt-4" />
        )}
      </article>

      {/* 上一篇 / 下一篇 */}
      {(prev || next) && (
        <nav className="mt-6 grid gap-3 sm:grid-cols-2 anim-fade-in">
          {prev ? (
            <Link
              href={`/moments/${prev.id}`}
              className="group rounded-lg border border-line bg-bg p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                <ArrowLeft className="w-3.5 h-3.5" />
                上一篇
              </span>
              <p className="mt-1.5 line-clamp-2 text-sm group-hover:text-primary transition-colors duration-200">
                {prev.content}
              </p>
            </Link>
          ) : (
            <span hidden />
          )}
          {next ? (
            <Link
              href={`/moments/${next.id}`}
              className="group rounded-lg border border-line bg-bg p-4 text-right transition-all duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                下一篇
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              <p className="mt-1.5 line-clamp-2 text-sm group-hover:text-primary transition-colors duration-200">
                {next.content}
              </p>
            </Link>
          ) : (
            <span hidden />
          )}
        </nav>
      )}

      <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-fg-muted">
        <CloudRain className="w-3.5 h-3.5 text-primary" />
        来自说说时间流
      </p>
    </div>
  );
}
