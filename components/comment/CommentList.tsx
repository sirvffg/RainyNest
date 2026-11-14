// components/comment/CommentList.tsx — 评论列表（递归树形渲染）
export interface CommentNode {
  id: string;
  content: string;
  createdAt: Date | string;
  user: { displayName: string; username: string; avatar?: string | null };
  replies: CommentNode[];
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function CommentItem({ comment }: { comment: CommentNode }) {
  return (
    <div className="anim-fade-in-up">
      <div className="flex gap-3">
        {/* 头像 */}
        {comment.user.avatar ? (
          <img
            src={comment.user.avatar}
            alt={comment.user.displayName}
            loading="lazy"
            className="w-9 h-9 shrink-0 rounded-full object-cover transition-transform duration-200 hover:scale-110"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-sm font-semibold text-fg-muted transition-colors duration-200 hover:text-primary">
            {(comment.user.displayName || '?').charAt(0)}
          </span>
        )}

        {/* 内容 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{comment.user.displayName}</span>
            <time dateTime={new Date(comment.createdAt).toISOString()} className="text-xs text-fg-muted">
              {formatDate(comment.createdAt)}
            </time>
          </div>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>
      </div>

      {/* 子回复（递归） */}
      {comment.replies.length > 0 && (
        <div className="mt-4 ml-8 space-y-4 border-l-2 border-line pl-4 md:ml-11">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentList({ comments }: { comments: CommentNode[] }) {
  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-fg-muted anim-fade-in">
        还没有评论 来抢沙发
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
