// components/markdown/CodeBlock.tsx — 带复制按钮的代码块
import CopyButton from './CopyButton';

export default function CodeBlock({
  code,
  language,
  filename,
  className = '',
}: {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-line bg-bg-secondary ${className}`}>
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs text-fg-muted">
        <span className="truncate font-mono">
          {filename || language || 'code'}
        </span>
        <CopyButton text={code} className="text-fg-muted hover:bg-bg hover:text-primary" />
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-sm leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
