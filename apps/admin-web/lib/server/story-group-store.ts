import { randomUUID } from 'node:crypto';

import { adminGroup, rootIdSchema } from '@open-story/contracts';
import { DbService } from '@open-story/db';

import { buildStoryGroupArchivePatch } from '@/lib/server/story-group-lifecycle';
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
  bottomLabel: string | null;
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
  bottomLabel?: unknown;
  bottom_label?: unknown;
  logoAssetId?: unknown;
  logo_asset_id?: unknown;
  storyGroupSetIds?: unknown;
  story_group_set_ids?: unknown;
  badge?: unknown;
  badgeType?: unknown;
  badgeValue?: unknown;
  storyIds?: unknown;
  story_ids?: unknown;
};

export class StoryGroupStoreError extends Error {
  public readonly status: number;
  public readonly code: 'validation_error' | 'not_found';

  constructor(
    message: string,
    status: number,
    code: 'validation_error' | 'not_found',
  ) {
    super(message);
    this.name = 'StoryGroupStoreError';
    this.status = status;
    this.code = code;
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

function validateStoryGroupSetIds(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new StoryGroupStoreError('Story Bar secimi liste formatinda olmalidir.', 400, 'validation_error');
  }

  const selectedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const item of value) {
    const normalizedId = parseString(item);
    const parsedId = rootIdSchema.safeParse(normalizedId);

    if (!parsedId.success) {
      throw new StoryGroupStoreError(
        'Story Bar seciminde yalnizca gecerli UUID degerleri kullanilabilir.',
        400,
        'validation_error',
      );
    }

    if (seenIds.has(parsedId.data)) {
      continue;
    }

    seenIds.add(parsedId.data);
    selectedIds.push(parsedId.data);
  }

  const availableSetIds = new Set(listStoryGroupSets().map((storyGroupSet) => storyGroupSet.id));

  for (const selectedId of selectedIds) {
    if (!availableSetIds.has(selectedId)) {
      throw new StoryGroupStoreError('Secilen Story Bar kaydi bulunamadi.', 404, 'not_found');
    }
  }

  return selectedIds;
}

function syncStoryGroupSetReferences(storyGroupId: string, selectedStoryGroupSetIds: string[]): void {
  const selectedIdSet = new Set(selectedStoryGroupSetIds);
  const storyGroupSets = listStoryGroupSets();

  for (const storyGroupSet of storyGroupSets) {
    const currentlyReferenced = storyGroupSet.groupIds.includes(storyGroupId);
    const shouldReference = selectedIdSet.has(storyGroupSet.id);

    if (currentlyReferenced === shouldReference) {
      continue;
    }

    const nextGroupIds = shouldReference
      ? Array.from(new Set([...storyGroupSet.groupIds, storyGroupId]))
      : storyGroupSet.groupIds.filter((groupId) => groupId !== storyGroupId);

    db.updateById<{ id: string; [key: string]: unknown }>('storyGroupSets', storyGroupSet.id, {
      groupIds: nextGroupIds,
      updatedAt: new Date().toISOString(),
    });
  }
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
    bottomLabel:
      parseString(rawRecord.bottomLabel) ??
      parseString(rawRecord.bottom_label) ??
      null,
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

function findStoryGroupById(id: string): { id: string; [key: string]: unknown } | undefined {
  return db.findById<{ id: string; [key: string]: unknown }>('storyGroups', id);
}

function getStoryGroupOrThrow(id: string): { id: string; [key: string]: unknown } {
  const record = findStoryGroupById(id);

  if (!record) {
    throw new StoryGroupStoreError('Story Group bulunamadı.', 404, 'not_found');
  }

  return record;
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
  const selectedStoryGroupSetIds = validateStoryGroupSetIds(
    payload.storyGroupSetIds ?? payload.story_group_set_ids,
  );

  const parsedPayload = adminGroup.createStoryGroupDtoSchema.safeParse({
    name: parseString(payload.name),
    bottom_label: parseString(payload.bottomLabel) ?? parseString(payload.bottom_label),
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
    bottomLabel: parsedPayload.data.bottom_label ?? null,
    currentDraftRevisionId: draftRevisionId,
    currentPublishedRevisionId: null,
    logoAssetId: parsedPayload.data.logo_asset_id,
    badge: parsedPayload.data.badge ?? null,
    storyIds: parsedPayload.data.story_ids,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  syncStoryGroupSetReferences(storyGroupId, selectedStoryGroupSetIds);

  const storyGroupSets = listStoryGroupSets();
  const createdRecord = db.findById<{ id: string; [key: string]: unknown }>('storyGroups', storyGroupId);

  if (!createdRecord) {
    throw new StoryGroupStoreError('Story Group oluşturulduktan sonra okunamadı.', 500, 'validation_error');
  }

  return normalizeStoryGroup(createdRecord, storyGroupSets);
}

export function updateStoryGroup(id: string, payload: CreateStoryGroupPayload): StoryGroupRecord {
  const existingRecord = getStoryGroupOrThrow(id);
  const existingStoryGroup = normalizeStoryGroup(existingRecord, listStoryGroupSets());
  const selectedStoryGroupSetIds = validateStoryGroupSetIds(
    payload.storyGroupSetIds ?? payload.story_group_set_ids,
  );

  const parsedPayload = adminGroup.updateStoryGroupDtoSchema.safeParse({
    name: payload.name === undefined ? undefined : parseString(payload.name),
    bottom_label:
      payload.bottomLabel === undefined && payload.bottom_label === undefined
        ? undefined
        : parseString(payload.bottomLabel) ?? parseString(payload.bottom_label),
    logo_asset_id:
      payload.logoAssetId === undefined && payload.logo_asset_id === undefined
        ? undefined
        : parseString(payload.logoAssetId) ?? parseString(payload.logo_asset_id),
    badge:
      payload.badge === undefined && payload.badgeType === undefined && payload.badgeValue === undefined
        ? undefined
        : normalizeBadge(payload.badge) ??
          normalizeBadge({
            type: payload.badgeType,
            value: payload.badgeValue,
          }),
    story_ids:
      payload.storyIds === undefined && payload.story_ids === undefined
        ? undefined
        : normalizeStringArray(payload.storyIds ?? payload.story_ids),
  });

  if (!parsedPayload.success) {
    const issue = parsedPayload.error.issues[0];
    throw new StoryGroupStoreError(issue?.message ?? 'Story Group payload geçersiz.', 400, 'validation_error');
  }

  const nextRecord = db.updateById<{ id: string; [key: string]: unknown }>('storyGroups', id, {
    name: parsedPayload.data.name ?? existingStoryGroup.name,
    bottomLabel:
      parsedPayload.data.bottom_label === undefined
        ? existingStoryGroup.bottomLabel
        : parsedPayload.data.bottom_label ?? null,
    logoAssetId: parsedPayload.data.logo_asset_id ?? existingStoryGroup.logoAssetId,
    badge:
      parsedPayload.data.badge !== undefined
        ? parsedPayload.data.badge
        : existingStoryGroup.badge,
    storyIds: parsedPayload.data.story_ids ?? existingStoryGroup.storyIds,
    currentDraftRevisionId: randomUUID(),
    updatedAt: new Date().toISOString(),
  });

  if (!nextRecord) {
    throw new StoryGroupStoreError('Story Group bulunamadı.', 404, 'not_found');
  }

  syncStoryGroupSetReferences(id, selectedStoryGroupSetIds);

  return normalizeStoryGroup(nextRecord, listStoryGroupSets());
}

export function setStoryGroupArchiveState(id: string, archived: boolean): StoryGroupRecord {
  getStoryGroupOrThrow(id);
  const now = new Date().toISOString();

  const nextRecord = db.updateById<{ id: string; [key: string]: unknown }>(
    'storyGroups',
    id,
    buildStoryGroupArchivePatch({ archived, now }),
  );

  if (!nextRecord) {
    throw new StoryGroupStoreError('Story Group bulunamadı.', 404, 'not_found');
  }

  return normalizeStoryGroup(nextRecord, listStoryGroupSets());
}

export function setStoryGroupPublishState(id: string, published: boolean): StoryGroupRecord {
  const existingRecord = getStoryGroupOrThrow(id);
  const currentDraftRevisionId =
    parseString(existingRecord.currentDraftRevisionId) ??
    parseString(existingRecord.current_draft_revision_id) ??
    randomUUID();

  const nextRecord = db.updateById<{ id: string; [key: string]: unknown }>('storyGroups', id, {
    currentDraftRevisionId,
    currentPublishedRevisionId: published ? currentDraftRevisionId : null,
    updatedAt: new Date().toISOString(),
  });

  if (!nextRecord) {
    throw new StoryGroupStoreError('Story Group bulunamadı.', 404, 'not_found');
  }

  return normalizeStoryGroup(nextRecord, listStoryGroupSets());
}
