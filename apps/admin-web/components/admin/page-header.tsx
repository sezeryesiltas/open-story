import { Badge } from '@open-story/ui/components/badge';
import { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_26px_60px_-34px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-8 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl space-y-3">
        <Badge
          className="rounded-full border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-300 hover:bg-white/[0.06]"
          variant="secondary"
        >
          {eyebrow}
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm leading-6 text-slate-400 sm:text-base">{description}</p>
        </div>
      </div>

      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
