// components/layout/SidebarPluginWidgets.tsx — 插件 widget 数据填充（client）
// 扫描插件渲染出的容器（data-widget-api），按当前路径 slug 调插件 customApi 拉取数据填充
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface WidgetItem {
  title: string;
  slug: string;
  summary?: string | null;
}

export default function SidebarPluginWidgets() {
  const pathname = usePathname();

  useEffect(() => {
    const containers = document.querySelectorAll<HTMLElement>('[data-widget-api]');
    if (!containers.length) return;

    // 从当前路径取 slug（/blog/xxx → xxx；首页取空）
    const slug = pathname?.split('/').filter(Boolean).pop() ?? '';

    containers.forEach((el) => {
      // 同一路径只加载一次（path 切换后重新拉取）
      if (el.getAttribute('data-loaded-path') === pathname) return;
      el.setAttribute('data-loaded-path', pathname ?? '');

      const api = el.getAttribute('data-widget-api');
      if (!api) return;
      const param = el.getAttribute('data-widget-param') || 'slug';

      fetch(`${api}?${param}=${encodeURIComponent(slug)}`)
        .then((res) => res.json())
        .then((data) => {
          const list: WidgetItem[] = data?.list ?? [];
          el.replaceChildren();

          if (!list.length) {
            const empty = document.createElement('p');
            empty.className = 'py-1 text-xs text-fg-muted';
            empty.textContent = '暂无相关内容';
            el.appendChild(empty);
            return;
          }

          const ul = document.createElement('ul');
          ul.className = 'space-y-2';
          for (const item of list) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `/blog/${item.slug}`;
            a.className =
              'block truncate text-sm text-fg-muted transition-all duration-200 hover:text-primary hover:translate-x-0.5';
            a.textContent = item.title;
            li.appendChild(a);
            ul.appendChild(li);
          }
          el.appendChild(ul);
        })
        .catch(() => {
          el.replaceChildren();
          const err = document.createElement('p');
          err.className = 'py-1 text-xs text-fg-muted';
          err.textContent = '加载失败 请稍后重试';
          el.appendChild(err);
        });
    });
  }, [pathname]);

  return null;
}
