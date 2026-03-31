import { ModulePage } from '@/components/admin/module-page';

export default function UsersPage() {
  return (
    <ModulePage
      description="Users ekranı v1’in tek rol modelini koruyarak admin kullanıcı oluşturma, geçici şifre yönetimi ve reset operasyonlarını toplar."
      eyebrow="Users"
      guardrails={[
        'İlk admin seed olarak gelir.',
        'Yeni kullanıcı yalnızca mevcut bir admin tarafından oluşturulur.',
        'İlk girişte parola değişikliği zorunludur.',
        'Self-service mail reset akışı v1 scope dışındadır.'
      ]}
      implementationSlices={[
        'Kullanıcı listesi ve hesap durum özeti',
        'Temporary password üreten create user akışı',
        'Force password change bayrağını görünür kılan detay kartı',
        'Başka bir admin üzerinden temporary password reset aksiyonu'
      ]}
      supportedActions={[
        'Kullanıcı listeleme',
        'Yeni admin oluşturma',
        'Temporary password reset',
        'First-login force change görünümü'
      ]}
      title="Admin user management"
    />
  );
}
