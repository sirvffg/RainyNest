// components/seo/JsonLd.tsx — 结构化数据（服务端组件）
// `<` 转义防止 `</script>` 提前闭合造成注入
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
