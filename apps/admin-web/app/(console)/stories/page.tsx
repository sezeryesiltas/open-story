import { ModulePage } from '@/components/admin/module-page';

export default function StoriesPage() {
  return (
    <ModulePage
      description="Story ekranı media-first içerik üretimini, CTA tanımını ve story revision publish davranışını taşır. Story yalnızca bir group altında yaşar."
      eyebrow="Stories"
      guardrails={[
        '`media_type` ne ise yalnızca ona uygun alanlar doldurulur.',
        'Video için poster zorunludur.',
        'CTA tamamen opsiyoneldir; varsa label, target type ve target value birlikte zorunludur.',
        'Delete yalnızca güvenli koşullarda ve live feed referansı bozulmadan yapılabilir.'
      ]}
      implementationSlices={[
        'Image/video alanlarını ayıran revision formu',
        'CTA paneli ve target type doğrulaması',
        'Move to another group akışı ve manual story ordering alanı',
        'Publish/unpublish/archive durumlarını root + revision modeliyle yansıtan liste'
      ]}
      supportedActions={[
        'Oluşturma ve düzenleme',
        'Listeleme ve draft kaydetme',
        'Publish ve unpublish',
        'Archive ve restore',
        'Move to another group / delete / manuel sıralama'
      ]}
      title="Story edit ve media yönetimi"
    />
  );
}
