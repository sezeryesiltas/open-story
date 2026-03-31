import { Badge } from '@open-story/ui/components/badge';
import { Card } from '@open-story/ui/components/card';
import { Separator } from '@open-story/ui/components/separator';
import { ReactNode } from 'react';

import { SidebarNav } from '@/components/admin/sidebar-nav';

const trafficLights = [
  'bg-[#ff5f57]',
  'bg-[#febc2e]',
  'bg-[#28c840]'
];

export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-6 lg:flex-row">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-[336px] lg:flex-none">
          <Card className="overflow-hidden rounded-[30px] border-white/10 bg-[linear-gradient(180deg,rgba(22,28,43,0.92)_0%,rgba(13,17,28,0.9)_100%)] shadow-[0_24px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <div className="bg-white/[0.03] px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {trafficLights.map((color) => (
                    <span key={color} className={`h-3 w-3 rounded-full ${color}`} />
                  ))}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Finder-style nav
                </p>
              </div>

              <Badge
                className="mt-5 rounded-full border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300 hover:bg-white/[0.06]"
                variant="secondary"
              >
                Open Story v1
              </Badge>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">
                Admin Console
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Single-tenant, placement-managed story delivery için dar kapsamlı operasyon
                yüzeyi.
              </p>
            </div>

            <Separator className="bg-white/10" />

            <div className="p-3">
              <SidebarNav />
            </div>

            <Separator className="bg-white/10" />

            <div className="bg-black/10 px-6 py-5 text-sm leading-6 text-slate-400">
              Scope dışı alanlar burada görünmez: theming, scheduling, analytics dashboard ve
              multi-tenant yönetim.
            </div>
          </Card>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,19,31,0.72)_0%,rgba(9,13,22,0.72)_100%)] p-3 shadow-[0_32px_100px_-52px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-4">
            <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,23,0.86)_0%,rgba(10,14,24,0.76)_100%)] p-4 sm:p-5 lg:p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
