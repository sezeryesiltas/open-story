import { ModulePage } from '@/components/admin/module-page';

export default function PreviewPage() {
  return (
    <ModulePage
      description="Preview ekranı basic editorial validation içindir. Native SDK ile görsel birebirlik değil, feed contract doğruluğu ve içerik görünürlüğü güvenilirliği hedeflenir."
      eyebrow="Preview"
      guardrails={[
        'Preview aynı feed contract üzerinden çalışmalıdır.',
        'Placement seçilerek önizleme başlatılır.',
        'CTA var/yok, image/video ayrımı ve sıra bilgisi açık görünmelidir.',
        'Targeting context simülasyonu v1 için zorunlu değildir.'
      ]}
      implementationSlices={[
        'Placement seçici ve preview oturumu başlatma alanı',
        'Feed snapshot ağacını group/story seviyesinde gösteren renderer',
        'CTA presence ve media type state özetleri',
        'Temel viewer akışını yaklaşık simüle eden geçiş bileşenleri'
      ]}
      supportedActions={[
        'Placement seçerek önizleme açma',
        'Group sırası ve story sırası görme',
        'CTA var/yok durumunu görme',
        'Image/video ayrımını görme'
      ]}
      title="Basic preview surface"
    />
  );
}
