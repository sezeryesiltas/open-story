import { Card, CardHeader, CardTitle } from '@open-story/ui/components/card';
import Image from 'next/image';
import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)_/_0.11),transparent_30%),linear-gradient(180deg,hsl(var(--muted)_/_0.22),transparent)]" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
        <Card className="relative overflow-hidden border-border/60 bg-card/90 shadow-sm">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-36 rounded-full bg-primary/10 blur-3xl" />
          <CardHeader className="relative p-8 sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center">
              <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm sm:h-40 sm:w-40">
                <Image
                  src="/branding/openstory-logo.png"
                  alt="Open Story"
                  width="160"
                  height="160"
                  className="h-full w-full object-cover scale-[1.34]"
                  priority
                  sizes="(min-width: 640px) 10rem, 9rem"
                />
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-muted-foreground">
                  Open Story Admin
                </p>
                <CardTitle className="text-3xl leading-tight sm:text-4xl">Hesap erişimi</CardTitle>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
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
