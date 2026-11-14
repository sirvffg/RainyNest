'use client';

import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';

export default function ImageInput({
  value,
  onChange,
  placeholder = '输入图片 URL 或点击上传',
  preview = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  preview?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded border border-line bg-bg px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="button"
        title="上传图片"
        onClick={() => fileRef.current?.click()}
        className="flex shrink-0 items-center gap-1.5 rounded border border-line px-2.5 py-2 text-xs text-fg-muted transition-all duration-200 hover:border-primary hover:text-primary active:scale-95"
      >
        <ImagePlus className="h-4 w-4" />
        <span className="hidden sm:inline">上传</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {preview && value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="预览"
          className="anim-scale-in h-9 w-9 shrink-0 rounded border border-line object-cover"
        />
      ) : null}
    </div>
  );
}
