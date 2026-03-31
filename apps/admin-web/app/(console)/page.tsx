import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import Link from 'next/link';
import { ArrowRight, Boxes, Compass, GitBranch, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/admin/page-header';
import { adminNavSections } from '@/lib/admin-navigation';

const deliverySlices = [
  {
    title: 'Admin auth + user flows',
    description: 'Email/password login, temporary password reset ve first-login password change.'
  },
  {
    title: 'Placement + client foundations',
    description: 'Tek client modeli, placement CRUD ve çoklu static token revoke akışı.'
  },
  {
    title: 'Revision-backed content',
    description: 'StoryGroupSet, StoryGroup ve Story root + revision modelini ayıran ekranlar.'
  },
  {
    title: 'Preview over feed contract',
    description: 'Admin preview aynı feed snapshot contract’ını tüketerek güvenilir görünürlük testi sunar.'
  }
];

const productGuardrails = [
  'Console tek tenant varsayımıyla çalışır; client seçici veya tenant yönetimi eklenmez.',
  'UI fixed kalır; host-controlled theming ya da placement surface abstraction bu çatıda yer almaz.',
  'StoryGroupSet targeting tek çözümleme katmanıdır; group veya story seviyesinde targeting eklenmez.',
  'Preview contract doğruluğuna odaklanır; native SDK ile piksel-perfect parity hedeflenmez.'
];

const deliveryOrder = [
  'Auth ve admin user flows',
  'Placement, client ve static token management',
  'Asset upload-first pipeline',
  'Revision model + publish validation + feed API',
  'Native SDK cache, bar ve viewer',
  'Basic preview'
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button asChild className="gap-2">
              <Link href="/placements">
                Placements ekranını aç
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Auth akışını gör</Link>
            </Button>
          </>
        }
        description="Bu ana sayfa, Admin Console çatısının dar kapsamlı v1 bilgi mimarisini gösterir. Menü yapısı PRD’deki temel ekranları birebir kapsar ve sonraki implementasyon adımları için temel operasyon yüzeyini hazırlar."
        eyebrow="Admin Console"
        title="Placement-managed story operations"
      />

      <section className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        {deliverySlices.map((slice) => {
          const icons = {
            'Admin auth + user flows': ShieldCheck,
            'Placement + client foundations': Compass,
            'Revision-backed content': GitBranch,
            'Preview over feed contract': Boxes
          } as const;

          const Icon = icons[slice.title as keyof typeof icons];

          return (
            <Card
              key={slice.title}
              className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]"
            >
              <CardHeader>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sky-300">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{slice.title}</CardTitle>
                <CardDescription className="leading-6">{slice.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
          <CardHeader>
            <CardTitle>Ekran haritası</CardTitle>
            <CardDescription>
              PRD’deki temel ekranlar menü grupları halinde hazırlandı.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {adminNavSections.map((section) => (
              <div
                key={section.title}
                className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {section.title}
                </p>
                <div className="mt-4 space-y-3">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-[0_18px_30px_-22px_rgba(0,0,0,0.85)]"
                      href={item.href}
                    >
                      <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
            <CardHeader>
              <CardTitle>Product guardrails</CardTitle>
              <CardDescription>
                Çatının scope drift üretmemesi için görünür tutulan kurallar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {productGuardrails.map((rule) => (
                  <li key={rule} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                    <span className="mt-2 h-2 w-2 rounded-full bg-sky-300" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-32px_rgba(0,0,0,0.92)]">
            <CardHeader>
              <CardTitle>Delivery order</CardTitle>
              <CardDescription>Bu shell bundan sonraki geliştirmeleri şu sırada taşıyacak.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {deliveryOrder.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                    <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-semibold text-sky-300">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
