import { ReactNode } from 'react';

import { Button, type ButtonProps } from '@open-story/ui/components/button';
import { cn } from '@open-story/ui/lib/utils';

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex max-w-3xl flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </header>
  );
}

export function PageHeaderActionButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        'h-12 rounded-[8px] bg-primary px-6 text-base font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)_/_0.18)] hover:bg-primary/90',
        className,
      )}
      {...props}
    />
  );
}
