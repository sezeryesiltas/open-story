import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { ReactNode } from 'react';

import { PageHeader } from '@/components/admin/page-header';

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
          <span className="mt-2 h-2 w-2 rounded-full bg-sky-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ModulePage({
  eyebrow,
  title,
  description,
  supportedActions,
  guardrails,
  implementationSlices,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  supportedActions: string[];
  guardrails: string[];
  implementationSlices: string[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader description={description} eyebrow={eyebrow} title={title} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
          <CardHeader>
            <CardTitle>Implementation slices</CardTitle>
            <CardDescription>
              Bu ekranın gerçek işlevselliğe taşınması için kodlanacak dar kapsamlı adımlar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {children ?? null}
            <BulletList items={implementationSlices} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
            <CardHeader>
              <CardTitle>Supported actions</CardTitle>
              <CardDescription>PRD’de bu modül için beklenen temel operasyonlar.</CardDescription>
            </CardHeader>
            <CardContent>
              <BulletList items={supportedActions} />
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
            <CardHeader>
              <CardTitle>Guardrails</CardTitle>
              <CardDescription>Bu ekranı v1 scope içinde tutan ürün kuralları.</CardDescription>
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
