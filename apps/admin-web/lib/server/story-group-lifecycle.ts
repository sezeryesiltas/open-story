export function buildStoryGroupArchivePatch({
  archived,
  now,
}: {
  archived: boolean;
  now: string;
}) {
  return {
    archivedAt: archived ? now : null,
    ...(archived ? { currentPublishedRevisionId: null } : {}),
    updatedAt: now,
  };
}
