import { ModulePage } from '@/components/admin/module-page';

export default function ClientPage() {
  return (
    <ModulePage
      description="Bu alan tek client görüntüleme/düzenleme ve static token lifecycle operasyonlarını toplar. V1’de multi-client yönetimi yoktur."
      eyebrow="Client & Tokens"
      guardrails={[
        'Sistemde tam olarak bir adet `Client` bulunur.',
        'Bir client altında birden fazla aktif static token olabilir.',
        'Revoke edilen token ile yapılan istekler yetkisiz sayılır.',
        'Token plain değeri yalnızca oluşturulduğu anda gösterilir; kalıcı saklama hash ile yapılır.'
      ]}
      implementationSlices={[
        'Tek client özet kartı ve editable settings formu',
        'Static token create modalı ve reveal-once davranışı',
        'Token listesi, `last_used_at` görünümü ve revoke action',
        'Revoke sonrası feed auth davranışını doğrulayan entegrasyon testleri'
      ]}
      supportedActions={[
        'Tek client görüntüleme/düzenleme',
        'Static token üretme',
        'Static token listeleme',
        'Static token revoke etme'
      ]}
      title="Client ve static token yönetimi"
    />
  );
}
