import type {
  AdminUserDto,
  AssetDto,
  ClientDto,
  CreateStoryDto,
  CreateStoryGroupDto,
  CreateStoryGroupSetDto,
  CreateStaticTokenDto,
  CreateStaticTokenResponseDto,
  PlacementDto,
  PublishStoryDto,
  PublishStoryGroupDto,
  PublishStoryGroupSetDto,
  ResetAdminUserPasswordDto,
  RevokeStaticTokenDto,
  StaticTokenDto,
  StoryDto,
  StoryGroupDto,
  StoryGroupSetDto,
  UpdateClientDto,
  UpdatePlacementDto,
  UpdateStoryDto,
  UpdateStoryGroupDto,
  UpdateStoryGroupSetDto,
} from '@open-story/contracts';

import { backendApiRequest } from './backend-api';

export type AdminPlacementRecord = PlacementDto & {
  connectedSetCount: number;
};

export type AdminAssetRecord = {
  id: string;
  type: AssetDto['type'];
  url: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  source: 'upload' | 'url';
  createdAt: string;
  updatedAt: string;
};

export type AdminStoryGroupSetRecord = {
  id: string;
  name: string;
  placementId: string;
  isFallback: boolean;
  platformTargets: Array<{
    platform: 'ios' | 'android';
    minAppVersion: string;
  }>;
  userSegments: string[];
  groupIds: string[];
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminStoryGroupRecord = {
  id: string;
  name: string;
  bottomLabel: string | null;
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  logoAssetId: string;
  badge: StoryGroupDto['badge'];
  storyIds: string[];
  storyCount: number;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
  archivedAt: string | null;
  storyGroupSets: Array<{
    id: string;
    name: string;
    placementId: string;
    isFallback: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type AdminStoryRecord = {
  id: string;
  name: string;
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  groupId: string;
  groupName: string;
  position: number | null;
  mediaType: 'image' | 'video';
  assetId: string;
  posterAssetId: string | null;
  imageDurationMs: number | null;
  cta: StoryDto['cta'];
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
};

export async function listPlacements(authToken?: string | null): Promise<AdminPlacementRecord[]> {
  const [placements, storyGroupSets] = await Promise.all([
    backendApiRequest<PlacementDto[]>('/v1/placements', { authToken }),
    backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken }),
  ]);

  const connectedSetCountByPlacementId = new Map<string, number>();
  for (const storyGroupSet of storyGroupSets) {
    connectedSetCountByPlacementId.set(
      storyGroupSet.placement_id,
      (connectedSetCountByPlacementId.get(storyGroupSet.placement_id) ?? 0) + 1,
    );
  }

  return placements.map((placement) => ({
    ...placement,
    connectedSetCount: connectedSetCountByPlacementId.get(placement.id) ?? 0,
  }));
}

export async function createPlacement(payload: PlacementDto | Omit<PlacementDto, 'id' | 'createdAt' | 'updatedAt'>, authToken?: string | null): Promise<PlacementDto> {
  return backendApiRequest<PlacementDto>('/v1/placements', {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });
}

export async function updatePlacement(placementId: string, payload: UpdatePlacementDto, authToken?: string | null): Promise<PlacementDto> {
  return backendApiRequest<PlacementDto>(`/v1/placements/${placementId}`, {
    method: 'PUT',
    authToken,
    body: JSON.stringify(payload),
  });
}

export async function listAssets(type?: string, authToken?: string | null): Promise<AdminAssetRecord[]> {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  const assets = await backendApiRequest<AssetDto[]>(`/v1/assets${query}`, {
    authToken,
  });

  return assets.map((asset) => ({
    ...asset,
  }));
}

export async function listStoryGroupSets(authToken?: string | null): Promise<AdminStoryGroupSetRecord[]> {
  const storyGroupSets = await backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', {
    authToken,
  });

  return storyGroupSets.map(mapStoryGroupSet);
}

export async function getStoryGroupSet(storyGroupSetId: string, authToken?: string | null): Promise<AdminStoryGroupSetRecord> {
  return mapStoryGroupSet(
    await backendApiRequest<StoryGroupSetDto>(`/v1/story-group-sets/${storyGroupSetId}`, {
      authToken,
    }),
  );
}

export async function createStoryGroupSet(payload: CreateStoryGroupSetDto, authToken?: string | null): Promise<AdminStoryGroupSetRecord> {
  return mapStoryGroupSet(
    await backendApiRequest<StoryGroupSetDto>('/v1/story-group-sets', {
      method: 'POST',
      authToken,
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateStoryGroupSet(storyGroupSetId: string, payload: UpdateStoryGroupSetDto, authToken?: string | null): Promise<AdminStoryGroupSetRecord> {
  return mapStoryGroupSet(
    await backendApiRequest<StoryGroupSetDto>(`/v1/story-group-sets/${storyGroupSetId}`, {
      method: 'PATCH',
      authToken,
      body: JSON.stringify(payload),
    }),
  );
}

export async function publishStoryGroupSet(storyGroupSetId: string, payload: PublishStoryGroupSetDto, authToken?: string | null): Promise<AdminStoryGroupSetRecord> {
  return mapStoryGroupSet(
    await backendApiRequest<StoryGroupSetDto>(`/v1/story-group-sets/${storyGroupSetId}/publish`, {
      method: 'POST',
      authToken,
      body: JSON.stringify(payload),
    }),
  );
}

export async function listStoryGroups(authToken?: string | null): Promise<AdminStoryGroupRecord[]> {
  const [storyGroups, storyGroupSets] = await Promise.all([
    backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken }),
    backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken }),
  ]);

  return storyGroups.map((storyGroup) => mapStoryGroup(storyGroup, storyGroupSets));
}

export async function getStoryGroup(storyGroupId: string, authToken?: string | null): Promise<AdminStoryGroupRecord> {
  const [storyGroup, storyGroupSets] = await Promise.all([
    backendApiRequest<StoryGroupDto>(`/v1/story-groups/${storyGroupId}`, { authToken }),
    backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken }),
  ]);

  return mapStoryGroup(storyGroup, storyGroupSets);
}

export async function createStoryGroup(payload: CreateStoryGroupDto, authToken?: string | null): Promise<AdminStoryGroupRecord> {
  const storyGroup = await backendApiRequest<StoryGroupDto>('/v1/story-groups', {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });

  const storyGroupSets = await backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken });
  return mapStoryGroup(storyGroup, storyGroupSets);
}

export async function updateStoryGroup(storyGroupId: string, payload: UpdateStoryGroupDto, authToken?: string | null): Promise<AdminStoryGroupRecord> {
  const storyGroup = await backendApiRequest<StoryGroupDto>(`/v1/story-groups/${storyGroupId}`, {
    method: 'PATCH',
    authToken,
    body: JSON.stringify(payload),
  });

  const storyGroupSets = await backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken });
  return mapStoryGroup(storyGroup, storyGroupSets);
}

export async function publishStoryGroup(storyGroupId: string, payload: PublishStoryGroupDto, authToken?: string | null): Promise<AdminStoryGroupRecord> {
  const storyGroup = await backendApiRequest<StoryGroupDto>(`/v1/story-groups/${storyGroupId}/publish`, {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });

  const storyGroupSets = await backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken });
  return mapStoryGroup(storyGroup, storyGroupSets);
}

export async function archiveStoryGroup(storyGroupId: string, archived: boolean, authToken?: string | null): Promise<AdminStoryGroupRecord> {
  const storyGroup = await backendApiRequest<StoryGroupDto>(`/v1/story-groups/${storyGroupId}/archive`, {
    method: 'POST',
    authToken,
    body: JSON.stringify({ archived }),
  });

  const storyGroupSets = await backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken });
  return mapStoryGroup(storyGroup, storyGroupSets);
}

export async function listStories(authToken?: string | null): Promise<AdminStoryRecord[]> {
  const [stories, storyGroups] = await Promise.all([
    backendApiRequest<StoryDto[]>('/v1/stories', { authToken }),
    backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken }),
  ]);

  return stories.map((story) => mapStory(story, storyGroups));
}

export async function getStory(storyId: string, authToken?: string | null): Promise<AdminStoryRecord> {
  const [story, storyGroups] = await Promise.all([
    backendApiRequest<StoryDto>(`/v1/stories/${storyId}`, { authToken }),
    backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken }),
  ]);

  return mapStory(story, storyGroups);
}

export async function createStory(payload: CreateStoryDto, authToken?: string | null): Promise<AdminStoryRecord> {
  const story = await backendApiRequest<StoryDto>('/v1/stories', {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });

  const storyGroups = await backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken });
  return mapStory(story, storyGroups);
}

export async function updateStory(storyId: string, payload: UpdateStoryDto, authToken?: string | null): Promise<AdminStoryRecord> {
  const story = await backendApiRequest<StoryDto>(`/v1/stories/${storyId}`, {
    method: 'PATCH',
    authToken,
    body: JSON.stringify(payload),
  });

  const storyGroups = await backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken });
  return mapStory(story, storyGroups);
}

export async function publishStory(storyId: string, payload: PublishStoryDto, authToken?: string | null): Promise<AdminStoryRecord> {
  const story = await backendApiRequest<StoryDto>(`/v1/stories/${storyId}/publish`, {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });

  const storyGroups = await backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken });
  return mapStory(story, storyGroups);
}

export async function archiveStory(storyId: string, archived: boolean, authToken?: string | null): Promise<AdminStoryRecord> {
  const story = await backendApiRequest<StoryDto>(`/v1/stories/${storyId}/archive`, {
    method: 'POST',
    authToken,
    body: JSON.stringify({ archived }),
  });

  const storyGroups = await backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken });
  return mapStory(story, storyGroups);
}

export async function getClient(authToken?: string | null): Promise<ClientDto> {
  return backendApiRequest<ClientDto>('/v1/client', { authToken });
}

export async function updateClient(payload: UpdateClientDto, authToken?: string | null): Promise<ClientDto> {
  return backendApiRequest<ClientDto>('/v1/client', {
    method: 'PATCH',
    authToken,
    body: JSON.stringify(payload),
  });
}

export async function listStaticTokens(authToken?: string | null): Promise<StaticTokenDto[]> {
  return backendApiRequest<StaticTokenDto[]>('/v1/client-tokens', { authToken });
}

export async function createStaticToken(payload: CreateStaticTokenDto, authToken?: string | null): Promise<CreateStaticTokenResponseDto> {
  return backendApiRequest<CreateStaticTokenResponseDto>('/v1/client-tokens', {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });
}

export async function revokeStaticToken(tokenId: string, payload: RevokeStaticTokenDto, authToken?: string | null): Promise<StaticTokenDto> {
  return backendApiRequest<StaticTokenDto>(`/v1/client-tokens/${tokenId}/revoke`, {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });
}

export async function listAdminUsers(authToken?: string | null): Promise<AdminUserDto[]> {
  return backendApiRequest<AdminUserDto[]>('/v1/admin-users', { authToken });
}

export async function createAdminUser(payload: { email: string; temporaryPassword: string }, authToken?: string | null): Promise<AdminUserDto> {
  return backendApiRequest<AdminUserDto>('/v1/admin-users', {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });
}

export async function resetAdminUserPassword(userId: string, payload: ResetAdminUserPasswordDto, authToken?: string | null): Promise<AdminUserDto> {
  return backendApiRequest<AdminUserDto>(`/v1/admin-users/${userId}/reset-password`, {
    method: 'POST',
    authToken,
    body: JSON.stringify(payload),
  });
}

export function mapStoryGroupSet(storyGroupSet: StoryGroupSetDto): AdminStoryGroupSetRecord {
  return {
    id: storyGroupSet.id,
    name: storyGroupSet.name,
    placementId: storyGroupSet.placement_id,
    isFallback: storyGroupSet.is_fallback,
    platformTargets: storyGroupSet.targets.map((target) => ({
      platform: target.platform,
      minAppVersion: target.min_app_version,
    })),
    userSegments: [...storyGroupSet.segments],
    groupIds: [...storyGroupSet.group_ids],
    currentDraftRevisionId: storyGroupSet.current_draft_revision_id,
    currentPublishedRevisionId: storyGroupSet.current_published_revision_id,
    createdAt: storyGroupSet.created_at,
    updatedAt: storyGroupSet.updated_at,
  };
}

export function mapStoryGroup(storyGroup: StoryGroupDto, storyGroupSets: StoryGroupSetDto[]): AdminStoryGroupRecord {
  return {
    id: storyGroup.id,
    name: storyGroup.name,
    bottomLabel: storyGroup.bottom_label,
    currentDraftRevisionId: storyGroup.current_draft_revision_id,
    currentPublishedRevisionId: storyGroup.current_published_revision_id,
    logoAssetId: storyGroup.logo_asset_id,
    badge: storyGroup.badge,
    storyIds: [...storyGroup.story_ids],
    storyCount: storyGroup.story_ids.length,
    archiveState: storyGroup.archived_at ? 'archived' : 'active',
    publishState: storyGroup.current_published_revision_id ? 'published' : 'unpublished',
    archivedAt: storyGroup.archived_at,
    storyGroupSets: storyGroupSets
      .filter((storyGroupSet) => storyGroupSet.group_ids.includes(storyGroup.id))
      .map((storyGroupSet) => ({
        id: storyGroupSet.id,
        name: storyGroupSet.name,
        placementId: storyGroupSet.placement_id,
        isFallback: storyGroupSet.is_fallback,
      })),
    createdAt: storyGroup.created_at,
    updatedAt: storyGroup.updated_at,
  };
}

export function mapStory(story: StoryDto, storyGroups: StoryGroupDto[]): AdminStoryRecord {
  const storyGroup = storyGroups.find((group) => group.id === story.group_id) ?? null;
  const position = storyGroup ? storyGroup.story_ids.indexOf(story.id) + 1 : null;

  return {
    id: story.id,
    name: story.name,
    currentDraftRevisionId: story.current_draft_revision_id,
    currentPublishedRevisionId: story.current_published_revision_id,
    groupId: story.group_id,
    groupName: storyGroup?.name ?? 'Unknown Story Group',
    position: position && position > 0 ? position : null,
    mediaType: story.media_type,
    assetId: story.asset_id,
    posterAssetId: story.poster_asset_id,
    imageDurationMs: story.image_duration_ms,
    cta: story.cta,
    archiveState: story.archived_at ? 'archived' : 'active',
    publishState: story.current_published_revision_id ? 'published' : 'unpublished',
    archivedAt: story.archived_at,
    createdAt: story.created_at,
    updatedAt: story.updated_at,
    canDelete: !story.current_published_revision_id,
  };
}

export function insertAtPosition(ids: string[], value: string, position: number): string[] {
  const nextIds = ids.filter((id) => id !== value);
  const targetIndex = Math.max(0, Math.min(nextIds.length, position - 1));
  nextIds.splice(targetIndex, 0, value);
  return nextIds;
}

export function removeId(ids: string[], value: string): string[] {
  return ids.filter((id) => id !== value);
}

export async function syncStoryGroupSetReferences(
  storyGroupId: string,
  nextStoryGroupSetIds: string[],
  authToken?: string | null,
): Promise<void> {
  const storyGroupSets = await backendApiRequest<StoryGroupSetDto[]>('/v1/story-group-sets', { authToken });
  const selectedSetIds = new Set(nextStoryGroupSetIds);

  for (const storyGroupSet of storyGroupSets) {
    const currentlyIncluded = storyGroupSet.group_ids.includes(storyGroupId);
    const shouldInclude = selectedSetIds.has(storyGroupSet.id);

    if (currentlyIncluded === shouldInclude) {
      continue;
    }

    await backendApiRequest<StoryGroupSetDto>(`/v1/story-group-sets/${storyGroupSet.id}`, {
      method: 'PATCH',
      authToken,
      body: JSON.stringify({
        group_ids: shouldInclude
          ? [...storyGroupSet.group_ids, storyGroupId]
          : removeId(storyGroupSet.group_ids, storyGroupId),
      }),
    });
  }
}

export async function syncStoryMembership(
  storyId: string,
  nextGroupId: string,
  position: number,
  authToken?: string | null,
): Promise<void> {
  const storyGroups = await backendApiRequest<StoryGroupDto[]>('/v1/story-groups', { authToken });
  const previousGroup = storyGroups.find((storyGroup) => storyGroup.story_ids.includes(storyId)) ?? null;
  const nextGroup = storyGroups.find((storyGroup) => storyGroup.id === nextGroupId) ?? null;

  if (!nextGroup) {
    throw new Error(`Target story group ${nextGroupId} not found.`);
  }

  if (previousGroup && previousGroup.id !== nextGroupId) {
    await backendApiRequest<StoryGroupDto>(`/v1/story-groups/${previousGroup.id}`, {
      method: 'PATCH',
      authToken,
      body: JSON.stringify({
        story_ids: removeId(previousGroup.story_ids, storyId),
      }),
    });
  }

  const nextStoryIds = insertAtPosition(
    previousGroup?.id === nextGroupId ? nextGroup.story_ids : [...nextGroup.story_ids, storyId],
    storyId,
    position,
  );

  await backendApiRequest<StoryGroupDto>(`/v1/story-groups/${nextGroupId}`, {
    method: 'PATCH',
    authToken,
    body: JSON.stringify({
      story_ids: nextStoryIds,
    }),
  });
}
