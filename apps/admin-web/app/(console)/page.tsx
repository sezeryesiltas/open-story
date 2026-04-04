import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import Link from 'next/link';
import { ArrowRight, Clapperboard, Eye, Layers3, SquareStack } from 'lucide-react';

import { PageHeader } from '@/components/admin/page-header';
import { adminNavSections } from '@/lib/admin-navigation';

const quickLinks = [
  {
    title: 'Placements',
    description: 'Gösterim alanlarını ekleyin ve düzenleyin.',
    href: '/placements',
    icon: Layers3,
  },
  {
    title: 'Story Bars',
    description: 'Story bar listelerini yönetin.',
    href: '/story-group-sets',
    icon: SquareStack,
  },
  {
    title: 'Stories',
    description: 'Story içeriklerini hazırlayın.',
    href: '/stories',
    icon: Clapperboard,
  },
  {
    title: 'Preview',
    description: 'İçeriğin görünümünü kontrol edin.',
    href: '/preview',
    icon: Eye,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button asChild className="gap-2">
              <Link href="/placements">
                Placements
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/preview">Önizlemeyi aç</Link>
            </Button>
          </>
        }
        description="İçerik, erişim ve ayarlara buradan ulaşabilirsiniz."
        eyebrow="Admin Console"
        title="Yönetim paneli"
      />

      <section className="grid auto-rows-min gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="border-border/60 bg-card/80">
              <CardHeader>
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription className="leading-6">{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={item.href}>Aç</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Tüm bölümler</CardTitle>
            <CardDescription>İhtiyacınız olan alana buradan geçin.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {adminNavSections.map((section) => (
              <div
                key={section.title}
                className="rounded-lg border border-border/60 bg-muted/30 p-4"
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{section.title}</p>
                <div className="mt-4 space-y-3">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      className="block rounded-lg border border-border/60 bg-background/60 px-4 py-3 transition-colors hover:bg-accent"
                      href={item.href}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Hızlı işlemler</CardTitle>
            <CardDescription>En sık kullanılan sayfalara kısa yoldan geçin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="justify-between" variant="outline">
              <Link href="/story-group-sets">
                Story Bars
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/stories">
                Stories
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/users">
                Users
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/settings">
                Settings
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
