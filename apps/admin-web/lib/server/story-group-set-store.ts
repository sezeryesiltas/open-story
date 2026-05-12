import { randomUUID } from 'node:crypto';

import { appVersionSchema, platformSchema, userSegmentSchema } from '@open-story/contracts';
import { DbService } from '@open-story/db';

import { listPlacements } from '@/lib/server/placement-store';

const db = new DbService();
const DEFAULT_TIMESTAMP = new Date(0).toISOString();

export type StoryGroupSetPlatformTarget = {
  platform: 'ios' | 'android';
  minAppVersion: string;
};

export type StoryGroupSetRecord = {
  id: string;
  name: string;
  placementId: string;
  minStoryGroupCount: number;
  maxStoryGroupCount: number;
  isFallback: boolean;
  platformTargets: StoryGroupSetPlatformTarget[];
  userSegments: string[];
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateStoryGroupSetPayload = {
  name?: string;
  placementId?: string;
  minStoryGroupCount?: number;
  maxStoryGroupCount?: number;
  isFallback?: boolean;
  platformTargets?: StoryGroupSetPlatformTarget[];
  userSegments?: string[];
  platforms?: StoryGroupSetPlatformTarget[];
  segments?: string[];
};

export type UpdateStoryGroupSetPayload = CreateStoryGroupSetPayload;

export class StoryGroupSetStoreError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: 'not_found' | 'validation_error',
  ) {
    super(message);
    this.name = 'StoryGroupSetStoreError';
  }
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function parseNonNegativeInteger(value: unknown, fallbackValue: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  const normalizedValue = parseString(value);
  if (!normalizedValue) {
    return fallbackValue;
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return fallbackValue;
  }

  return parsedValue;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => parseString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizePlatformTarget(value: unknown): StoryGroupSetPlatformTarget | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    platform?: unknown;
    minAppVersion?: unknown;
    min_app_version?: unknown;
  };

  const platformResult = platformSchema.safeParse(candidate.platform);
  const minVersionResult = appVersionSchema.safeParse(
    parseString(candidate.minAppVersion) ?? parseString(candidate.min_app_version),
  );

  if (!platformResult.success || !minVersionResult.success) {
    return null;
  }

  return {
    platform: platformResult.data,
    minAppVersion: minVersionResult.data,
  };
}

function normalizePlatformTargets(value: unknown): StoryGroupSetPlatformTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueTargets = new Map<string, StoryGroupSetPlatformTarget>();

  for (const item of value) {
    const normalizedTarget = normalizePlatformTarget(item);
    if (!normalizedTarget) {
      continue;
    }

    uniqueTargets.set(normalizedTarget.platform, normalizedTarget);
  }

  return Array.from(uniqueTargets.values()).sort((left, right) => left.platform.localeCompare(right.platform));
}

function normalizeUserSegments(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const segments: string[] = [];
  const segmentSet = new Set<string>();

  for (const item of value) {
    const result = userSegmentSchema.safeParse(parseString(item));
    if (!result.success || segmentSet.has(result.data)) {
      continue;
    }

    segmentSet.add(result.data);
    segments.push(result.data);
  }

  return segments;
}

function normalizeStoryGroupSet(rawRecord: { id: string; [key: string]: unknown }): StoryGroupSetRecord {
  const minStoryGroupCount = parseNonNegativeInteger(rawRecord.minStoryGroupCount, 0);
  const maxStoryGroupCount = Math.max(
    minStoryGroupCount,
    parseNonNegativeInteger(rawRecord.maxStoryGroupCount, minStoryGroupCount),
  );
  const createdAt = parseString(rawRecord.createdAt) ?? DEFAULT_TIMESTAMP;
  const updatedAt = parseString(rawRecord.updatedAt) ?? createdAt;

  return {
    id: rawRecord.id,
    name: parseString(rawRecord.name) ?? 'Untitled Story Bar',
    placementId:
      parseString(rawRecord.placementId) ??
      parseString(rawRecord.placement_id) ??
      '',
    minStoryGroupCount,
    maxStoryGroupCount,
    isFallback: Boolean(rawRecord.isFallback ?? rawRecord.is_fallback ?? false),
    platformTargets: normalizePlatformTargets(rawRecord.platformTargets ?? rawRecord.platforms),
    userSegments: normalizeUserSegments(rawRecord.userSegments ?? rawRecord.segments),
    groupIds: normalizeStringArray(rawRecord.groupIds ?? rawRecord.group_ids),
    createdAt,
    updatedAt,
  };
}

function findStoryGroupSetById(id: string): StoryGroupSetRecord | undefined {
  const record = db.findById<{ id: string; [key: string]: unknown }>('storyGroupSets', id);
  return record ? normalizeStoryGroupSet(record) : undefined;
}

function ensurePlacementExists(placementId: string): void {
  const placementExists = listPlacements().some((placement) => placement.id === placementId);

  if (!placementExists) {
    throw new StoryGroupSetStoreError(
      'A valid placement must be selected for the Story Bar record.',
      404,
      'not_found',
    );
  }
}

function validatePlatformTargets(value: unknown): StoryGroupSetPlatformTarget[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new StoryGroupSetStoreError(
      'platformTargets must be a valid list.',
      400,
      'validation_error',
    );
  }

  const targets: StoryGroupSetPlatformTarget[] = [];
  const seenPlatforms = new Set<'ios' | 'android'>();

  for (const item of value) {
    const normalizedTarget = normalizePlatformTarget(item);

    if (!normalizedTarget) {
      throw new StoryGroupSetStoreError(
        'Platform and min app version must both be valid in platform targets.',
        400,
        'validation_error',
      );
    }

    if (seenPlatforms.has(normalizedTarget.platform)) {
      throw new StoryGroupSetStoreError(
        `Only one platform target can be defined for ${normalizedTarget.platform}.`,
        400,
        'validation_error',
      );
    }

    seenPlatforms.add(normalizedTarget.platform);
    targets.push(normalizedTarget);
  }

  return targets.sort((left, right) => left.platform.localeCompare(right.platform));
}

function validateUserSegments(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new StoryGroupSetStoreError(
      'userSegments must be a valid list.',
      400,
      'validation_error',
    );
  }

  const userSegments: string[] = [];
  const userSegmentSet = new Set<string>();

  for (const item of value) {
    const normalizedValue = parseString(item);
    const result = userSegmentSchema.safeParse(normalizedValue);

    if (!result.success) {
      throw new StoryGroupSetStoreError(
        'Segment values cannot be empty and can be at most 64 characters.',
        400,
        'validation_error',
      );
    }

    if (!userSegmentSet.has(result.data)) {
      userSegmentSet.add(result.data);
      userSegments.push(result.data);
    }
  }

  return userSegments;
}

function resolveCount(value: number | undefined, fallbackValue: number, fieldName: string): number {
  const resolvedValue = value ?? fallbackValue;

  if (!Number.isInteger(resolvedValue) || resolvedValue < 0) {
    throw new StoryGroupSetStoreError(
      `${fieldName} must be zero or a positive integer.`,
      400,
      'validation_error',
    );
  }

  return resolvedValue;
}

function sanitizeStoryGroupSetPayload(
  payload: CreateStoryGroupSetPayload | UpdateStoryGroupSetPayload,
  existingRecord?: StoryGroupSetRecord,
): Omit<StoryGroupSetRecord, 'id' | 'groupIds' | 'createdAt' | 'updatedAt'> {
  const name = parseString(payload.name) ?? existingRecord?.name;
  const placementId = parseString(payload.placementId) ?? existingRecord?.placementId;

  if (!name || name.length < 2) {
    throw new StoryGroupSetStoreError(
      'Story Bar name must be at least 2 characters.',
      400,
      'validation_error',
    );
  }

  if (!placementId) {
    throw new StoryGroupSetStoreError(
      'A placement must be selected for the Story Bar record.',
      400,
      'validation_error',
    );
  }

  ensurePlacementExists(placementId);

  const minStoryGroupCount = resolveCount(
    payload.minStoryGroupCount,
    existingRecord?.minStoryGroupCount ?? 0,
    'min_story_group_count',
  );
  const maxStoryGroupCount = resolveCount(
    payload.maxStoryGroupCount,
    existingRecord?.maxStoryGroupCount ?? minStoryGroupCount,
    'max_story_group_count',
  );

  if (minStoryGroupCount > maxStoryGroupCount) {
    throw new StoryGroupSetStoreError(
      'min_story_group_count cannot be greater than max_story_group_count.',
      400,
      'validation_error',
    );
  }

  const isFallback = payload.isFallback ?? existingRecord?.isFallback ?? false;
  const platformTargets = validatePlatformTargets(
    payload.platformTargets ?? payload.platforms ?? existingRecord?.platformTargets ?? [],
  );
  const userSegments = validateUserSegments(
    payload.userSegments ?? payload.segments ?? existingRecord?.userSegments ?? [],
  );

  return {
    name,
    placementId,
    minStoryGroupCount,
    maxStoryGroupCount,
    isFallback,
    platformTargets: isFallback ? [] : platformTargets,
    userSegments: isFallback ? [] : userSegments,
  };
}

export function listStoryGroupSets(): StoryGroupSetRecord[] {
  return db
    .list<{ id: string; [key: string]: unknown }>('storyGroupSets')
    .map(normalizeStoryGroupSet)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createStoryGroupSet(payload: CreateStoryGroupSetPayload): StoryGroupSetRecord {
  const now = new Date().toISOString();
  const normalizedPayload = sanitizeStoryGroupSetPayload(payload);

  return db.insert<StoryGroupSetRecord>('storyGroupSets', {
    id: randomUUID(),
    ...normalizedPayload,
    groupIds: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function updateStoryGroupSet(
  id: string,
  payload: UpdateStoryGroupSetPayload,
): StoryGroupSetRecord {
  const existingRecord = findStoryGroupSetById(id);

  if (!existingRecord) {
    throw new StoryGroupSetStoreError(
      'Story Bar was not found.',
      404,
      'not_found',
    );
  }

  const updatedRecord: StoryGroupSetRecord = {
    ...existingRecord,
    ...sanitizeStoryGroupSetPayload(payload, existingRecord),
    updatedAt: new Date().toISOString(),
  };

  db.insert<StoryGroupSetRecord>('storyGroupSets', updatedRecord);

  return updatedRecord;
}
