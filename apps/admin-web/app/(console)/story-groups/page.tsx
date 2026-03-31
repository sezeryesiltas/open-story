import { ModulePage } from '@/components/admin/module-page';

export default function StoryGroupsPage() {
  return (
    <ModulePage
      description="StoryGroup ekranı, story bar giriş noktalarının paylaşımlı yapısını yönetir. Aynı group birden fazla set içinde referanslanabildiği için lifecycle net tutulur."
      eyebrow="Story Groups"
      guardrails={[
        'Logo zorunludur ve kare olmalıdır.',
        'Badge icon varsa yalnızca emoji veya svg olabilir.',
        'Aynı group birden fazla set içinde shared reference olarak kullanılabilir.',
        'Hard delete yoktur; archive / restore modeli uygulanır.'
      ]}
      implementationSlices={[
        'Group listesi, archive filtresi ve restore action',
        'Logo upload alanı ve badge validation yüzeyi',
        'Published revision görünümü ile draft çalışma alanını ayıran editör',
        'Shared group kullanım bilgisini gösteren reference summary kartı'
      ]}
      supportedActions={[
        'Oluşturma',
        'Düzenleme ve kopyalama',
        'Listeleme',
        'Archive ve restore',
        'Publish ve unpublish'
      ]}
      title="Group lifecycle ekranı"
    />
  );
}
