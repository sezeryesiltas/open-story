import { ModulePage } from '@/components/admin/module-page';

export default function StoryGroupSetsPage() {
  return (
    <ModulePage
      description="StoryGroupSet ekranı placement bağlantısı, targeting kuralları ve set composition yönetimini taşır. Publish validation bu modülün merkezindedir."
      eyebrow="Story Group Sets"
      guardrails={[
        'Fallback set ise targeting alanları boş olmalıdır.',
        'Aynı çözümleme sonucunu üretebilecek published set çakışmaları bloklanmalıdır.',
        'Group sırası manuel yönetilir; otomatik tie-break davranışı normal akış olarak kabul edilmez.',
        'Delete yalnızca unpublished set üzerinde mümkündür.'
      ]}
      implementationSlices={[
        'Root/revision ayrımını yansıtan draft/published durum kartları',
        'Placement seçici, platform targets ve user segment editörü',
        'Sete group ekleme/çıkarma ve drag-free manuel sıralama',
        'Publish validation hatalarını kullanıcıya deterministik şekilde gösteren akış'
      ]}
      supportedActions={[
        'Oluşturma ve düzenleme',
        'Draft kaydetme ve listeleme',
        'Publish ve unpublish',
        'Delete',
        'Sete group ekleme / setten group çıkarma / sıralama değiştirme'
      ]}
      title="Set targeting ve composition"
    />
  );
}
