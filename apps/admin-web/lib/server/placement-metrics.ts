type PlacementRecord = {
  id: string;
};

export type PlacementListItem<T extends PlacementRecord> = T & {
  connectedSetCount: number;
};

type StoryGroupSetPlacementReference = {
  placementId?: unknown;
  placement_id?: unknown;
  [key: string]: unknown;
};

function normalizePlacementId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function readPlacementId(storyGroupSet: StoryGroupSetPlacementReference): string | null {
  return normalizePlacementId(storyGroupSet.placementId) ?? normalizePlacementId(storyGroupSet.placement_id);
}

export function countConnectedSetsByPlacement(
  storyGroupSets: StoryGroupSetPlacementReference[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const storyGroupSet of storyGroupSets) {
    const placementId = readPlacementId(storyGroupSet);
    if (!placementId) {
      continue;
    }

    counts.set(placementId, (counts.get(placementId) ?? 0) + 1);
  }

  return counts;
}

export function attachConnectedSetCounts<T extends PlacementRecord>(
  placements: T[],
  storyGroupSets: StoryGroupSetPlacementReference[],
): Array<PlacementListItem<T>> {
  const counts = countConnectedSetsByPlacement(storyGroupSets);

  return placements.map((placement) => ({
    ...placement,
    connectedSetCount: counts.get(placement.id) ?? 0,
  }));
}
