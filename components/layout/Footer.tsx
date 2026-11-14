import Link from 'next/link';
import { Github, Mail, Twitter, CloudRain } from 'lucide-react';
import { getSiteSetting } from '@/lib/site';

export default async function Footer() {
  const site = await getSiteSetting();

  return (
    <footer className="border-t border-line mt-16 anim-fade-in">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <CloudRain className="w-4 h-4 text-primary" />
            <span>{site.footerText || `© ${new Date().getFullYear()} ${site.title} · Powered by RainyNest`}</span>
          </div>

          <div className="flex items-center gap-2">
            {site.githubUrl && (
              <Link href={site.githubUrl} target="_blank" rel="noopener noreferrer" aria-label="GitHub"
                className="p-2 rounded text-fg-muted transition-all duration-200 active:scale-90 hover:text-fg hover:bg-bg-secondary">
                <Github className="w-5 h-5" />
              </Link>
            )}
            {site.twitterUrl && (
              <Link href={site.twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="Twitter"
                className="p-2 rounded text-fg-muted transition-all duration-200 active:scale-90 hover:text-fg hover:bg-bg-secondary">
                <Twitter className="w-5 h-5" />
              </Link>
            )}
            {site.email && (
              <Link href={`mailto:${site.email}`} aria-label="邮箱"
                className="p-2 rounded text-fg-muted transition-all duration-200 active:scale-90 hover:text-fg hover:bg-bg-secondary">
                <Mail className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

        {site.icp && (
          <p className="mt-4 text-center text-xs text-fg-muted">
            <Link href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-primary">
              {site.icp}
            </Link>
          </p>
        )}
      </div>
    </footer>
  );
}
