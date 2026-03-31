import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import Link from 'next/link';

import { CreatePlacementForm } from '@/components/admin/create-placement-form';
import { PageHeader } from '@/components/admin/page-header';

const supportedActions = ['create', 'edit', 'list'];

const guardrails = [
  '`key` unique kalmalı; SDK çözümlemesi yalnızca `placement_key` üzerinden yapılır.',
  'Placement render zamanı belirlenir; SDK init sırasında sabitlenmez.',
  'Bu modül generic placement engine değildir; story bar yerleşimi yönetir.'
];

const nextSlices = [
  'Placement listing tablosu ve arama/filtre alanı',
  'Backend create/update mutation bağlantısı',
  'Optimistic olmayan ama deterministik form error davranışı',
  'CRUD testleri ve form validation coverage'
];

export default function PlacementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href="/">Dashboard&apos;a dön</Link>
          </Button>
        }
        description="Placement yönetimi bu ürünün sabit giriş noktalarını tanımlar. v1’de yalnızca story bar surface’i için create, edit ve list akışları bulunur."
        eyebrow="Placements"
        title="Placement yönetim ekranı"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
          <CardHeader>
            <CardTitle>Yeni placement</CardTitle>
            <CardDescription>
              Bu demo form mevcut shell içinde placement create akışının yerini sabitler.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CreatePlacementForm />

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-sm font-semibold text-slate-100">Sonraki gerçek implementasyon</p>
              <ul className="mt-3 space-y-3">
                {nextSlices.map((slice) => (
                  <li key={slice} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                    <span className="mt-2 h-2 w-2 rounded-full bg-sky-300" />
                    <span>{slice}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
            <CardHeader>
              <CardTitle>Supported actions</CardTitle>
              <CardDescription>PRD’de bu modül için tanımlanan işlemler.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {supportedActions.map((action) => (
                  <li key={action} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                    <span className="mt-2 h-2 w-2 rounded-full bg-sky-300" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
            <CardHeader>
              <CardTitle>Guardrails</CardTitle>
              <CardDescription>Placement ekranı scope’u bu sınırlar içinde kalır.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {guardrails.map((rule) => (
                  <li key={rule} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                    <span className="mt-2 h-2 w-2 rounded-full bg-sky-300" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
