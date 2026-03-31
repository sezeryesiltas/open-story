import { Layers, ShieldCheck, Upload } from 'lucide-react';

import { CreatePlacementForm } from '@/components/admin/create-placement-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const deliveryPlan = [
  {
    title: 'Admin auth + user flows',
    description: 'Email/password girişi, geçici şifre ve ilk girişte şifre yenileme akışları.',
    icon: ShieldCheck
  },
  {
    title: 'Placement + static token yönetimi',
    description: 'Tek Client altında placement CRUD ve çoklu static token yönetimi/revoke.',
    icon: Layers
  },
  {
    title: 'Asset upload-first pipeline',
    description: 'Görsel/video yükleme, metadata doğrulama ve yayın öncesi taslak akışı.',
    icon: Upload
  }
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Open Story v1 Admin Console</p>
        <h1 className="text-3xl font-semibold">Placement odaklı Story Bar yönetimi</h1>
        <p className="max-w-3xl text-muted-foreground">
          Bu panel sadece v1 kapsamındaki sabit UI ve revision tabanlı yaşam döngülerine odaklanır.
          Scope dışı özellikler (A/B test, çok kiracılı yapı, web sdk) bilerek dışarıda tutulur.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {deliveryPlan.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title}>
              <CardHeader>
                <Icon className="mb-3 h-5 w-5 text-primary" />
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Placement oluştur (taslak demo formu)</CardTitle>
          <CardDescription>
            Sonraki adımda bu form backend `Placement` endpoint&apos;ine bağlanacak.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatePlacementForm />
        </CardContent>
      </Card>
    </main>
  );
}
