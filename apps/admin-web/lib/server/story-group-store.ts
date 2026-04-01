import { randomUUID } from 'node:crypto';

import { adminGroup } from '@open-story/contracts';
import { DbService } from '@open-story/db';

import { listStoryGroupSets } from '@/lib/server/story-group-set-store';

const db = new DbService();
const DEFAULT_TIMESTAMP = new Date(0).toISOString();

type StoryGroupBadge = {
  type: 'emoji' | 'svg';
  value: string;
};

type StoryGroupSetSummary = {
  id: string;
  name: string;
  placementId: string;
  isFallback: boolean;
};

export type StoryGroupRecord = {
  id: string;
  name: string;
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  logoAssetId: string;
  badge: StoryGroupBadge | null;
  storyIds: string[];
  storyCount: number;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
  archivedAt: string | null;
  storyGroupSets: StoryGroupSetSummary[];
  createdAt: string;
  updatedAt: string;
};

export type CreateStoryGroupPayload = {
  name?: unknown;
  logoAssetId?: unknown;
  logo_asset_id?: unknown;
  badge?: unknown;
  badgeType?: unknown;
  badgeValue?: unknown;
  storyIds?: unknown;
  story_ids?: unknown;
};

export class StoryGroupStoreError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: 'validation_error',
  ) {
    super(message);
    this.name = 'StoryGroupStoreError';
  }
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => parseString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeBadge(value: unknown): StoryGroupBadge | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    type?: unknown;
    value?: unknown;
  };

  const badgeType = parseString(candidate.type);
  const badgeValue = parseString(candidate.value);

  if ((badgeType !== 'emoji' && badgeType !== 'svg') || !badgeValue) {
    return null;
  }

  return {
    type: badgeType,
    value: badgeValue,
  };
}

function normalizeStoryGroup(
  rawRecord: { id: string; [key: string]: unknown },
  storyGroupSets: Array<{
    id: string;
    name: string;
    placementId: string;
    isFallback: boolean;
    groupIds: string[];
  }>,
): StoryGroupRecord {
  const createdAt = parseString(rawRecord.createdAt) ?? DEFAULT_TIMESTAMP;
  const updatedAt = parseString(rawRecord.updatedAt) ?? createdAt;
  const archivedAt = parseString(rawRecord.archivedAt) ?? parseString(rawRecord.archived_at);
  const currentPublishedRevisionId =
    parseString(rawRecord.currentPublishedRevisionId) ??
    parseString(rawRecord.current_published_revision_id);
  const explicitPublishedFlag = parseBoolean(rawRecord.isPublished);
  const explicitArchivedFlag = parseBoolean(rawRecord.isArchived);
  const storyIds = normalizeStringArray(rawRecord.storyIds ?? rawRecord.story_ids);
  const storyGroupSetRefs = storyGroupSets
    .filter((storyGroupSet) => storyGroupSet.groupIds.includes(rawRecord.id))
    .map((storyGroupSet) => ({
      id: storyGroupSet.id,
      name: storyGroupSet.name,
      placementId: storyGroupSet.placementId,
      isFallback: storyGroupSet.isFallback,
    }));

  return {
    id: rawRecord.id,
    name: parseString(rawRecord.name) ?? parseString(rawRecord.title) ?? 'Untitled Story Group',
    currentDraftRevisionId:
      parseString(rawRecord.currentDraftRevisionId) ??
      parseString(rawRecord.current_draft_revision_id) ??
      `draft:${rawRecord.id}`,
    currentPublishedRevisionId,
    logoAssetId:
      parseString(rawRecord.logoAssetId) ??
      parseString(rawRecord.logo_asset_id) ??
      '',
    badge:
      normalizeBadge(rawRecord.badge) ??
      normalizeBadge({
        type: rawRecord.badgeType ?? rawRecord.badge_icon_type,
        value: rawRecord.badgeValue ?? rawRecord.badge_icon_value,
      }),
    storyIds,
    storyCount: storyIds.length,
    archiveState: archivedAt || explicitArchivedFlag ? 'archived' : 'active',
    publishState:
      explicitPublishedFlag === false
        ? 'unpublished'
        : explicitPublishedFlag === true || currentPublishedRevisionId
          ? 'published'
          : 'unpublished',
    archivedAt,
    storyGroupSets: storyGroupSetRefs,
    createdAt,
    updatedAt,
  };
}

export function listStoryGroups(): StoryGroupRecord[] {
  const storyGroupSets = listStoryGroupSets();

  return db
    .list<{ id: string; [key: string]: unknown }>('storyGroups')
    .map((record) => normalizeStoryGroup(record, storyGroupSets))
    .sort((left, right) => {
      const updatedAtComparison = right.updatedAt.localeCompare(left.updatedAt);
      if (updatedAtComparison !== 0) {
        return updatedAtComparison;
      }

      return left.name.localeCompare(right.name, 'tr');
    });
}

export function createStoryGroup(payload: CreateStoryGroupPayload): StoryGroupRecord {
  const parsedPayload = adminGroup.createStoryGroupDtoSchema.safeParse({
    name: parseString(payload.name),
    logo_asset_id: parseString(payload.logoAssetId) ?? parseString(payload.logo_asset_id),
    badge:
      normalizeBadge(payload.badge) ??
      normalizeBadge({
        type: payload.badgeType,
        value: payload.badgeValue,
      }),
    story_ids: normalizeStringArray(payload.storyIds ?? payload.story_ids),
  });

  if (!parsedPayload.success) {
    const issue = parsedPayload.error.issues[0];
    throw new StoryGroupStoreError(issue?.message ?? 'Story Group payload geçersiz.', 400, 'validation_error');
  }

  const now = new Date().toISOString();
  const storyGroupId = randomUUID();
  const draftRevisionId = randomUUID();

  db.insert('storyGroups', {
    id: storyGroupId,
    name: parsedPayload.data.name,
    currentDraftRevisionId: draftRevisionId,
    currentPublishedRevisionId: null,
    logoAssetId: parsedPayload.data.logo_asset_id,
    badge: parsedPayload.data.badge ?? null,
    storyIds: parsedPayload.data.story_ids,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const storyGroupSets = listStoryGroupSets();
  const createdRecord = db.findById<{ id: string; [key: string]: unknown }>('storyGroups', storyGroupId);

  if (!createdRecord) {
    throw new StoryGroupStoreError('Story Group oluşturulduktan sonra okunamadı.', 500, 'validation_error');
  }

  return normalizeStoryGroup(createdRecord, storyGroupSets);
}
