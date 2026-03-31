'use client';

import { Button } from '@open-story/ui/components/button';
import { cn } from '@open-story/ui/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { adminNavSections } from '@/lib/admin-navigation';

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {adminNavSections.map((section) => (
        <div key={section.title} className="space-y-2">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            {section.title}
          </p>

          <div className="space-y-1.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <Button
                  asChild
                  key={item.href}
                  className={cn(
                    'h-auto w-full justify-start rounded-2xl border px-4 py-3.5 text-left whitespace-normal transition-all duration-150',
                    active
                      ? 'border-sky-400/30 bg-[linear-gradient(135deg,rgba(76,147,255,0.22),rgba(61,89,212,0.16))] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_30px_-24px_rgba(89,167,255,0.9)]'
                      : 'border-transparent bg-white/[0.03] text-slate-200 hover:border-white/10 hover:bg-white/[0.06]'
                  )}
                  variant="ghost"
                >
                  <Link href={item.href}>
                    <div className="flex w-full items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 rounded-xl border p-2',
                          active
                            ? 'border-white/10 bg-white/10 text-slate-50'
                            : 'border-white/10 bg-black/20 text-slate-300'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p
                          className={cn(
                            'mt-1 text-xs leading-5',
                            active ? 'text-sky-100/90' : 'text-slate-500'
                          )}
                        >
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
