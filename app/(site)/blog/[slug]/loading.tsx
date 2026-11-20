// app/(site)/blog/[slug]/loading.tsx — 文章详情骨架屏
export default function BlogPostLoading() {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-10">
      <div className="min-w-0 max-w-3xl mx-auto lg:mx-0">
        {/* 标题 */}
        <div className="skeleton h-9 w-3/4" />
        <div className="mt-3 skeleton h-9 w-1/2" />

        {/* 元信息 */}
        <div className="mt-5 flex items-center gap-3">
          <div className="skeleton h-3.5 w-20" />
          <div className="skeleton h-3.5 w-28" />
          <div className="skeleton h-3.5 w-16" />
        </div>

        <hr className="mt-6 border-line" />

        {/* 正文段落 */}
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="skeleton h-4"
              style={{ width: `${[100, 96, 92, 100, 88, 94, 70, 100][i]}%` }}
            />
          ))}
        </div>
        <div className="mt-6 skeleton h-40 w-full" />

        {/* 评论区 */}
        <div className="mt-14 space-y-4">
          <div className="skeleton h-6 w-24" />
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      </div>

      {/* 侧栏目录 */}
      <aside className="hidden lg:block">
        <div className="skeleton h-5 w-20" />
        <div className="mt-4 space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-3.5" style={{ width: `${[90, 75, 85, 60, 70][i]}%` }} />
          ))}
        </div>
      </aside>
    </div>
  );
}
