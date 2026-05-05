import { PreviewWorkspace } from '@/components/admin/preview-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function PreviewPage() {
  await requireAdminPageAccess('/preview');

  return <PreviewWorkspace />;
}
