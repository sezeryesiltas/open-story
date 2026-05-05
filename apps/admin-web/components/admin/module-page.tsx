import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { ReactNode } from 'react';

import { PageHeader } from '@/components/admin/page-header';

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
          <span className="mt-2 h-2 w-2 rounded-full bg-primary/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ModulePage({
  title,
  supportedActions,
  guardrails,
  implementationSlices,
  children
}: {
  title: string;
  supportedActions: string[];
  guardrails: string[];
  implementationSlices: string[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Implementation slices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {children ?? null}
            <BulletList items={implementationSlices} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Supported actions</CardTitle>
            </CardHeader>
            <CardContent>
              <BulletList items={supportedActions} />
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Guardrails</CardTitle>
            </CardHeader>
            <CardContent>
              <BulletList items={guardrails} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
