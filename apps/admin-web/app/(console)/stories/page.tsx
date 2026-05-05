import { StoriesWorkspace } from '@/components/admin/stories-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function StoriesPage() {
  await requireAdminPageAccess('/stories');

  return <StoriesWorkspace />;
}
