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
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl space-y-3">
        <Badge className="w-fit uppercase tracking-[0.2em]" variant="secondary">
          {eyebrow}
        </Badge>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        </div>
      </div>

      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
