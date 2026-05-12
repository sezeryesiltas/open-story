import { DashboardDataVolume } from '@/components/admin/dashboard-data-volume';
import { PageHeader } from '@/components/admin/page-header';
import { BackendApiError, getAdminAuthTokenFromCookies } from '@/lib/server/backend-api';
import { loadDashboardDataVolumeSnapshot } from '@/lib/server/dashboard-data-volume';

async function loadDashboardDataVolume() {
  try {
    const authToken = await getAdminAuthTokenFromCookies();

    return {
      snapshot: await loadDashboardDataVolumeSnapshot(authToken),
      errorMessage: undefined,
    };
  } catch (error) {
    return {
      snapshot: null,
      errorMessage:
        error instanceof BackendApiError || error instanceof Error
          ? error.message
          : 'Active data volume could not be read.',
    };
  }
}

export default async function DashboardPage() {
  const { snapshot, errorMessage } = await loadDashboardDataVolume();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        description="Overview and content summaries"
        title="Dashboard"
      />

      <DashboardDataVolume errorMessage={errorMessage} snapshot={snapshot} />
    </div>
  );
}
