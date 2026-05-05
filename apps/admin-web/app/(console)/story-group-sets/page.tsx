import { StoryGroupSetsWorkspace } from '@/components/admin/story-group-sets-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function StoryGroupSetsPage() {
  await requireAdminPageAccess('/story-group-sets');

  return <StoryGroupSetsWorkspace />;
}
