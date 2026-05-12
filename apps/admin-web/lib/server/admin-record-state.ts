export type AdminPublishState = 'published' | 'unpublished';

export function getAdminCurrentPublishedRevisionId(
  archivedAt: string | null,
  currentPublishedRevisionId: string | null,
): string | null {
  return archivedAt ? null : currentPublishedRevisionId;
}

export function getAdminPublishState(
  archivedAt: string | null,
  currentPublishedRevisionId: string | null,
): AdminPublishState {
  return getAdminCurrentPublishedRevisionId(archivedAt, currentPublishedRevisionId)
    ? 'published'
    : 'unpublished';
}
