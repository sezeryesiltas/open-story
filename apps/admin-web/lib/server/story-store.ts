import { randomUUID } from 'node:crypto';

import { adminStory } from '@open-story/contracts';
import type { Cta } from '@open-story/contracts';
import { DbService } from '@open-story/db';

import { listAssets } from '@/lib/server/asset-store';
import { buildStoryArchivePatch } from '@/lib/server/story-lifecycle';
import { listStoryGroups } from '@/lib/server/story-group-store';

const db = new DbService();
const DEFAULT_TIMESTAMP = new Date(0).toISOString();

const updateStoryPayloadSchema = adminStory.createStoryDtoSchema.partial().strict();

type StoryGroupSummary = {
  id: string;
  name: string;
  storyIds: string[];
};

type AssetType = 'story_image' | 'story_video' | 'story_poster';

export type StoryRecord = {
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
  cta: Cta | null;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
};

export type CreateStoryPayload = {
  name?: unknown;
  groupId?: unknown;
  group_id?: unknown;
  mediaType?: unknown;
  media_type?: unknown;
  assetId?: unknown;
  asset_id?: unknown;
  posterAssetId?: unknown;
  poster_asset_id?: unknown;
  imageDurationMs?: unknown;
  image_duration_ms?: unknown;
  cta?: unknown;
  ctaLabel?: unknown;
  cta_label?: unknown;
  ctaType?: unknown;
  cta_type?: unknown;
  ctaTargetType?: unknown;
  cta_target_type?: unknown;
  ctaValue?: unknown;
  cta_value?: unknown;
  ctaTargetValue?: unknown;
  cta_target_value?: unknown;
  position?: unknown;
};

export class StoryStoreError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: 'validation_error' | 'not_found' | 'conflict',
  ) {
    super(message);
    this.name = 'StoryStoreError';
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

function parseNullablePositiveInteger(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return null;
}

function parsePosition(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsedValue = parseNullablePositiveInteger(value);
  if (!parsedValue) {
    throw new StoryStoreError('Story pozisyonu pozitif tam sayı olmalıdır.', 400, 'validation_error');
  }

  return parsedValue;
}

function normalizeCta(value: unknown): Cta | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    label?: unknown;
    type?: unknown;
    value?: unknown;
  };

  const parsedValue = adminStory.storySchema.shape.cta.safeParse({
    label: parseString(candidate.label),
    type: parseString(candidate.type),
    value: parseString(candidate.value),
  });

  if (!parsedValue.success) {
    return null;
  }

  return parsedValue.data;
}

function normalizeStoryGroupMap(): Map<string, StoryGroupSummary> {
  return new Map(
    listStoryGroups().map((storyGroup) => [
      storyGroup.id,
      {
        id: storyGroup.id,
        name: storyGroup.name,
        storyIds: storyGroup.storyIds,
      },
    ]),
  );
}

function normalizeStory(
  rawRecord: { id: string; [key: string]: unknown },
  storyGroupMap: Map<string, StoryGroupSummary>,
): StoryRecord {
  const createdAt = parseString(rawRecord.createdAt) ?? DEFAULT_TIMESTAMP;
  const updatedAt = parseString(rawRecord.updatedAt) ?? createdAt;
  const archivedAt = parseString(rawRecord.archivedAt) ?? parseString(rawRecord.archived_at);
  const currentPublishedRevisionId =
    parseString(rawRecord.currentPublishedRevisionId) ??
    parseString(rawRecord.current_published_revision_id);
  const explicitPublishedFlag = parseBoolean(rawRecord.isPublished);
  const explicitArchivedFlag = parseBoolean(rawRecord.isArchived);
  const groupId =
    parseString(rawRecord.groupId) ??
    parseString(rawRecord.storyGroupId) ??
    parseString(rawRecord.group_id) ??
    parseString(rawRecord.story_group_id) ??
    '';
  const storyGroup = storyGroupMap.get(groupId);
  const cta =
    normalizeCta(rawRecord.cta) ??
    normalizeCta({
      label: rawRecord.ctaLabel ?? rawRecord.cta_label,
      type: rawRecord.ctaType ?? rawRecord.cta_type ?? rawRecord.ctaTargetType ?? rawRecord.cta_target_type,
      value: rawRecord.ctaValue ?? rawRecord.cta_value ?? rawRecord.ctaTargetValue ?? rawRecord.cta_target_value,
    });
  const storyIds = storyGroup?.storyIds ?? [];
  const positionIndex = storyIds.indexOf(rawRecord.id);

  return {
    id: rawRecord.id,
    name: parseString(rawRecord.name) ?? parseString(rawRecord.title) ?? 'Untitled Story',
    currentDraftRevisionId:
      parseString(rawRecord.currentDraftRevisionId) ??
      parseString(rawRecord.current_draft_revision_id) ??
      rawRecord.id,
    currentPublishedRevisionId,
    groupId,
    groupName: storyGroup?.name ?? 'Unknown Story Group',
    position: positionIndex >= 0 ? positionIndex + 1 : null,
    mediaType:
      parseString(rawRecord.mediaType) === 'video' || parseString(rawRecord.media_type) === 'video'
        ? 'video'
        : 'image',
    assetId:
      parseString(rawRecord.assetId) ??
      parseString(rawRecord.asset_id) ??
      parseString(rawRecord.mediaAssetId) ??
      parseString(rawRecord.media_asset_id) ??
      parseString(rawRecord.imageAssetId) ??
      parseString(rawRecord.image_asset_id) ??
      parseString(rawRecord.videoAssetId) ??
      parseString(rawRecord.video_asset_id) ??
      '',
    posterAssetId:
      parseString(rawRecord.posterAssetId) ??
      parseString(rawRecord.poster_asset_id) ??
      parseString(rawRecord.videoPosterAssetId) ??
      parseString(rawRecord.video_poster_asset_id) ??
      null,
    imageDurationMs:
      parseNullablePositiveInteger(rawRecord.imageDurationMs ?? rawRecord.image_duration_ms) ?? null,
    cta,
    archiveState: archivedAt || explicitArchivedFlag ? 'archived' : 'active',
    publishState:
      explicitPublishedFlag === false
        ? 'unpublished'
        : explicitPublishedFlag === true || currentPublishedRevisionId
          ? 'published'
          : 'unpublished',
    archivedAt,
    createdAt,
    updatedAt,
    canDelete: !currentPublishedRevisionId,
  };
}

function findStoryById(id: string): { id: string; [key: string]: unknown } | undefined {
  return db.findById<{ id: string; [key: string]: unknown }>('stories', id);
}

function getStoryOrThrow(id: string): { id: string; [key: string]: unknown } {
  const record = findStoryById(id);

  if (!record) {
    throw new StoryStoreError('Story bulunamadı.', 404, 'not_found');
  }

  return record;
}

function getStoryGroupOrThrow(id: string, storyGroupMap: Map<string, StoryGroupSummary>): StoryGroupSummary {
  const storyGroup = storyGroupMap.get(id);

  if (!storyGroup) {
    throw new StoryStoreError('Story Group bulunamadı.', 404, 'not_found');
  }

  return storyGroup;
}

function getAssetOrThrow(id: string, expectedType: AssetType) {
  const asset = listAssets().find((entry) => entry.id === id);

  if (!asset) {
    throw new StoryStoreError('Seçilen asset kaydı bulunamadı.', 404, 'not_found');
  }

  if (asset.type !== expectedType) {
    throw new StoryStoreError(
      expectedType === 'story_video'
        ? 'Video story için `story_video` asseti seçilmelidir.'
        : expectedType === 'story_poster'
          ? 'Video poster için `story_poster` asseti seçilmelidir.'
          : 'Image story için `story_image` asseti seçilmelidir.',
      400,
      'validation_error',
    );
  }

  return asset;
}

function assertStoryMediaShape(values: {
  mediaType: 'image' | 'video';
  assetId: string;
  posterAssetId: string | null;
  imageDurationMs: number | null;
}): void {
  if (values.mediaType === 'image') {
    getAssetOrThrow(values.assetId, 'story_image');

    if (values.posterAssetId) {
      throw new StoryStoreError('Image story için poster asset gönderilmez.', 400, 'validation_error');
    }

    return;
  }

  getAssetOrThrow(values.assetId, 'story_video');

  if (!values.posterAssetId) {
    throw new StoryStoreError('Video story için poster asset zorunludur.', 400, 'validation_error');
  }

  getAssetOrThrow(values.posterAssetId, 'story_poster');

  if (values.imageDurationMs !== null) {
    throw new StoryStoreError('Image duration override yalnızca image story için kullanılabilir.', 400, 'validation_error');
  }
}

function insertStoryIdAtPosition(storyIds: string[], storyId: string, position?: number): string[] {
  const storyIdsWithoutCurrent = storyIds.filter((candidateId) => candidateId !== storyId);

  if (position === undefined) {
    if (storyIds.includes(storyId)) {
      return storyIds;
    }

    return [...storyIdsWithoutCurrent, storyId];
  }

  const nextStoryIds = [...storyIdsWithoutCurrent];
  const insertionIndex = Math.min(Math.max(position - 1, 0), nextStoryIds.length);
  nextStoryIds.splice(insertionIndex, 0, storyId);
  return nextStoryIds;
}

function storyIdsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function updateStoryGroupOrder(groupId: string, nextStoryIds: string[]): void {
  const storyGroup = db.findById<{ id: string; [key: string]: unknown }>('storyGroups', groupId);

  if (!storyGroup) {
    throw new StoryStoreError('Story Group bulunamadı.', 404, 'not_found');
  }

  const currentStoryIds = Array.isArray(storyGroup.storyIds)
    ? storyGroup.storyIds.filter((value): value is string => typeof value === 'string')
    : [];

  if (storyIdsEqual(currentStoryIds, nextStoryIds)) {
    return;
  }

  db.updateById<{ id: string; [key: string]: unknown }>('storyGroups', groupId, {
    storyIds: nextStoryIds,
    currentDraftRevisionId: randomUUID(),
    updatedAt: new Date().toISOString(),
  });
}

function moveStoryBetweenGroups(params: {
  storyId: string;
  fromGroupId?: string | null;
  toGroupId: string;
  position?: number;
  storyGroupMap: Map<string, StoryGroupSummary>;
}): void {
  const targetGroup = getStoryGroupOrThrow(params.toGroupId, params.storyGroupMap);

  if (!params.fromGroupId || params.fromGroupId === params.toGroupId) {
    const nextStoryIds = insertStoryIdAtPosition(targetGroup.storyIds, params.storyId, params.position);
    updateStoryGroupOrder(targetGroup.id, nextStoryIds);
    return;
  }

  const sourceGroup = getStoryGroupOrThrow(params.fromGroupId, params.storyGroupMap);
  updateStoryGroupOrder(
    sourceGroup.id,
    sourceGroup.storyIds.filter((storyId) => storyId !== params.storyId),
  );
  updateStoryGroupOrder(
    targetGroup.id,
    insertStoryIdAtPosition(targetGroup.storyIds, params.storyId, params.position),
  );
}

function parseStoryCreatePayload(payload: CreateStoryPayload) {
  const parsedPayload = adminStory.createStoryDtoSchema.safeParse({
    group_id: parseString(payload.groupId) ?? parseString(payload.group_id),
    name: parseString(payload.name),
    media_type: parseString(payload.mediaType) ?? parseString(payload.media_type),
    asset_id: parseString(payload.assetId) ?? parseString(payload.asset_id),
    poster_asset_id:
      payload.posterAssetId === undefined && payload.poster_asset_id === undefined
        ? undefined
        : parseString(payload.posterAssetId) ?? parseString(payload.poster_asset_id),
    image_duration_ms:
      payload.imageDurationMs === undefined && payload.image_duration_ms === undefined
        ? undefined
        : parseNullablePositiveInteger(payload.imageDurationMs ?? payload.image_duration_ms),
    cta:
      payload.cta !== undefined
        ? normalizeCta(payload.cta)
        : normalizeCta({
            label: payload.ctaLabel ?? payload.cta_label,
            type: payload.ctaType ?? payload.cta_type ?? payload.ctaTargetType ?? payload.cta_target_type,
            value: payload.ctaValue ?? payload.cta_value ?? payload.ctaTargetValue ?? payload.cta_target_value,
          }),
  });

  if (!parsedPayload.success) {
    const issue = parsedPayload.error.issues[0];
    throw new StoryStoreError(issue?.message ?? 'Story payload geçersiz.', 400, 'validation_error');
  }

  return {
    data: parsedPayload.data,
    position: parsePosition(payload.position),
  };
}

function parseStoryUpdatePayload(payload: CreateStoryPayload) {
  const parsedPayload = updateStoryPayloadSchema.safeParse({
    group_id:
      payload.groupId === undefined && payload.group_id === undefined
        ? undefined
        : parseString(payload.groupId) ?? parseString(payload.group_id),
    name: payload.name === undefined ? undefined : parseString(payload.name),
    media_type:
      payload.mediaType === undefined && payload.media_type === undefined
        ? undefined
        : parseString(payload.mediaType) ?? parseString(payload.media_type),
    asset_id:
      payload.assetId === undefined && payload.asset_id === undefined
        ? undefined
        : parseString(payload.assetId) ?? parseString(payload.asset_id),
    poster_asset_id:
      payload.posterAssetId === undefined && payload.poster_asset_id === undefined
        ? undefined
        : parseString(payload.posterAssetId) ?? parseString(payload.poster_asset_id),
    image_duration_ms:
      payload.imageDurationMs === undefined && payload.image_duration_ms === undefined
        ? undefined
        : parseNullablePositiveInteger(payload.imageDurationMs ?? payload.image_duration_ms),
    cta:
      payload.cta === undefined &&
      payload.ctaLabel === undefined &&
      payload.cta_label === undefined &&
      payload.ctaType === undefined &&
      payload.cta_type === undefined &&
      payload.ctaTargetType === undefined &&
      payload.cta_target_type === undefined &&
      payload.ctaValue === undefined &&
      payload.cta_value === undefined &&
      payload.ctaTargetValue === undefined &&
      payload.cta_target_value === undefined
        ? undefined
        : payload.cta !== undefined
          ? normalizeCta(payload.cta)
          : normalizeCta({
              label: payload.ctaLabel ?? payload.cta_label,
              type: payload.ctaType ?? payload.cta_type ?? payload.ctaTargetType ?? payload.cta_target_type,
              value: payload.ctaValue ?? payload.cta_value ?? payload.ctaTargetValue ?? payload.cta_target_value,
            }),
  });

  if (!parsedPayload.success) {
    const issue = parsedPayload.error.issues[0];
    throw new StoryStoreError(issue?.message ?? 'Story payload geçersiz.', 400, 'validation_error');
  }

  return {
    data: parsedPayload.data,
    position: parsePosition(payload.position),
  };
}

function ctaEqual(left: Cta | null, right: Cta | null): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.label === right.label && left.type === right.type && left.value === right.value;
}

export function listStories(): StoryRecord[] {
  const storyGroupMap = normalizeStoryGroupMap();

  return db
    .list<{ id: string; [key: string]: unknown }>('stories')
    .map((record) => normalizeStory(record, storyGroupMap))
    .sort((left, right) => {
      const groupNameComparison = left.groupName.localeCompare(right.groupName, 'tr');
      if (groupNameComparison !== 0) {
        return groupNameComparison;
      }

      const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }

      const updatedAtComparison = right.updatedAt.localeCompare(left.updatedAt);
      if (updatedAtComparison !== 0) {
        return updatedAtComparison;
      }

      return left.name.localeCompare(right.name, 'tr');
    });
}

export function createStory(payload: CreateStoryPayload): StoryRecord {
  const parsedPayload = parseStoryCreatePayload(payload);
  const storyGroupMap = normalizeStoryGroupMap();

  getStoryGroupOrThrow(parsedPayload.data.group_id, storyGroupMap);

  assertStoryMediaShape({
    mediaType: parsedPayload.data.media_type,
    assetId: parsedPayload.data.asset_id,
    posterAssetId: parsedPayload.data.poster_asset_id ?? null,
    imageDurationMs: parsedPayload.data.image_duration_ms ?? null,
  });

  const now = new Date().toISOString();
  const storyId = randomUUID();
  const draftRevisionId = randomUUID();

  db.insert('stories', {
    id: storyId,
    groupId: parsedPayload.data.group_id,
    name: parsedPayload.data.name,
    mediaType: parsedPayload.data.media_type,
    assetId: parsedPayload.data.asset_id,
    posterAssetId: parsedPayload.data.poster_asset_id ?? null,
    imageDurationMs: parsedPayload.data.image_duration_ms ?? null,
    cta: parsedPayload.data.cta ?? null,
    currentDraftRevisionId: draftRevisionId,
    currentPublishedRevisionId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  moveStoryBetweenGroups({
    storyId,
    fromGroupId: null,
    toGroupId: parsedPayload.data.group_id,
    position: parsedPayload.position,
    storyGroupMap,
  });

  const createdStory = findStoryById(storyId);

  if (!createdStory) {
    throw new StoryStoreError('Story oluşturulduktan sonra okunamadı.', 500, 'validation_error');
  }

  return normalizeStory(createdStory, normalizeStoryGroupMap());
}

export function updateStory(id: string, payload: CreateStoryPayload): StoryRecord {
  const existingRecord = getStoryOrThrow(id);
  const storyGroupMap = normalizeStoryGroupMap();
  const existingStory = normalizeStory(existingRecord, storyGroupMap);
  const parsedPayload = parseStoryUpdatePayload(payload);
  const nextGroupId = parsedPayload.data.group_id ?? existingStory.groupId;

  getStoryGroupOrThrow(nextGroupId, storyGroupMap);

  const nextName = parsedPayload.data.name ?? existingStory.name;
  const nextMediaType = parsedPayload.data.media_type ?? existingStory.mediaType;
  const nextAssetId = parsedPayload.data.asset_id ?? existingStory.assetId;
  const nextPosterAssetId =
    parsedPayload.data.poster_asset_id === undefined
      ? existingStory.posterAssetId
      : parsedPayload.data.poster_asset_id ?? null;
  const nextImageDurationMs =
    parsedPayload.data.image_duration_ms === undefined
      ? existingStory.imageDurationMs
      : parsedPayload.data.image_duration_ms ?? null;
  const nextCta = parsedPayload.data.cta === undefined ? existingStory.cta : parsedPayload.data.cta ?? null;

  assertStoryMediaShape({
    mediaType: nextMediaType,
    assetId: nextAssetId,
    posterAssetId: nextPosterAssetId,
    imageDurationMs: nextImageDurationMs,
  });

  const contentChanged =
    nextName !== existingStory.name ||
    nextMediaType !== existingStory.mediaType ||
    nextAssetId !== existingStory.assetId ||
    nextPosterAssetId !== existingStory.posterAssetId ||
    nextImageDurationMs !== existingStory.imageDurationMs ||
    !ctaEqual(nextCta, existingStory.cta);

  const nextRecord = db.updateById<{ id: string; [key: string]: unknown }>('stories', id, {
    groupId: nextGroupId,
    name: nextName,
    mediaType: nextMediaType,
    assetId: nextAssetId,
    posterAssetId: nextPosterAssetId,
    imageDurationMs: nextImageDurationMs,
    cta: nextCta,
    currentDraftRevisionId: contentChanged ? randomUUID() : existingStory.currentDraftRevisionId,
    updatedAt: new Date().toISOString(),
  });

  if (!nextRecord) {
    throw new StoryStoreError('Story bulunamadı.', 404, 'not_found');
  }

  moveStoryBetweenGroups({
    storyId: id,
    fromGroupId: existingStory.groupId,
    toGroupId: nextGroupId,
    position: parsedPayload.position,
    storyGroupMap,
  });

  return normalizeStory(nextRecord, normalizeStoryGroupMap());
}

export function setStoryArchiveState(id: string, archived: boolean): StoryRecord {
  getStoryOrThrow(id);
  const now = new Date().toISOString();

  const nextRecord = db.updateById<{ id: string; [key: string]: unknown }>(
    'stories',
    id,
    buildStoryArchivePatch({ archived, now }),
  );

  if (!nextRecord) {
    throw new StoryStoreError('Story bulunamadı.', 404, 'not_found');
  }

  return normalizeStory(nextRecord, normalizeStoryGroupMap());
}

export function setStoryPublishState(id: string, published: boolean): StoryRecord {
  const existingRecord = getStoryOrThrow(id);
  const currentDraftRevisionId =
    parseString(existingRecord.currentDraftRevisionId) ??
    parseString(existingRecord.current_draft_revision_id) ??
    randomUUID();

  const nextRecord = db.updateById<{ id: string; [key: string]: unknown }>('stories', id, {
    currentDraftRevisionId,
    currentPublishedRevisionId: published ? currentDraftRevisionId : null,
    updatedAt: new Date().toISOString(),
  });

  if (!nextRecord) {
    throw new StoryStoreError('Story bulunamadı.', 404, 'not_found');
  }

  return normalizeStory(nextRecord, normalizeStoryGroupMap());
}

export function deleteStory(id: string): void {
  const storyGroupMap = normalizeStoryGroupMap();
  const existingStory = normalizeStory(getStoryOrThrow(id), storyGroupMap);

  if (existingStory.publishState === 'published') {
    throw new StoryStoreError(
      'Published story silinemez. Önce unpublish edin veya archive kullanın.',
      409,
      'conflict',
    );
  }

  updateStoryGroupOrder(
    existingStory.groupId,
    getStoryGroupOrThrow(existingStory.groupId, storyGroupMap).storyIds.filter((storyId) => storyId !== id),
  );

  const deleted = db.deleteById('stories', id);

  if (!deleted) {
    throw new StoryStoreError('Story silinemedi.', 404, 'not_found');
  }
}
