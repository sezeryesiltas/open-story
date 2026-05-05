import { Card, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,138,44,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
        <Card className="relative overflow-hidden rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(18,24,39,0.94)_0%,rgba(8,12,20,0.96)_100%)] text-white shadow-[0_32px_100px_-52px_rgba(0,0,0,1)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-36 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),rgba(255,255,255,0)_70%)] blur-3xl" />
          <CardHeader className="relative p-8 sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center">
              <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-[30px] border border-white/15 bg-white shadow-[0_22px_50px_-30px_rgba(255,255,255,0.7)] sm:h-40 sm:w-40">
                <img
                  src="/branding/openstory-logo.png"
                  alt="Open Story"
                  width="160"
                  height="160"
                  className="h-full w-full object-cover scale-[1.34]"
                />
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/55">
                  Open Story Admin
                </p>
                <CardTitle className="text-3xl leading-tight sm:text-4xl">Hesap erişimi</CardTitle>
                <p className="max-w-sm text-sm leading-6 text-slate-300">
                  Yerleşim bazlı story akışlarını, yayın durumlarını ve içerik revizyonlarını yönetmek için giriş yapın.
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
