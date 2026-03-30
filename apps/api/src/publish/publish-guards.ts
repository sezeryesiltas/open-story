export class PublishConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishConflictError';
  }
}

export type Platform = 'ios' | 'android';

export interface PlatformTarget {
  platform: Platform;
  minAppVersion: string;
}

export interface TargetingRule {
  platformTargets: PlatformTarget[];
  userSegments: string[];
}

export interface PublishedSet {
  id: string;
  placementId: string;
  isFallback: boolean;
  targeting: TargetingRule;
}

export interface GroupRevisionSnapshot {
  storyIds: string[];
}

export interface SetRevisionSnapshot {
  storyGroupIds: string[];
  platformTargets: PlatformTarget[];
  userSegments: string[];
  isFallback: boolean;
}

export function validateStoryGroupCountRange(minStoryGroupCount: number, maxStoryGroupCount: number): void {
  if (minStoryGroupCount > maxStoryGroupCount) {
    throw new PublishConflictError(
      `Invalid story group count range: min_story_group_count (${minStoryGroupCount}) cannot be greater than max_story_group_count (${maxStoryGroupCount}).`,
    );
  }
}

export function enforceSinglePublishedFallback(placementId: string, publishedSets: PublishedSet[], candidateSetId?: string): void {
  const fallbackCount = publishedSets.filter((set) => set.placementId === placementId && set.isFallback && set.id !== candidateSetId).length;

  if (fallbackCount > 0) {
    throw new PublishConflictError(
      `Placement ${placementId} already has a published fallback set. Only one published fallback is allowed per placement.`,
    );
  }
}

export function enforceNoTargetingConflict(placementId: string, incomingSet: PublishedSet, publishedSets: PublishedSet[]): void {
  for (const current of publishedSets) {
    if (current.placementId !== placementId || current.id === incomingSet.id || current.isFallback || incomingSet.isFallback) {
      continue;
    }

    if (isAmbiguousTargetingPair(current.targeting, incomingSet.targeting)) {
      throw new PublishConflictError(
        `Targeting conflict detected between sets ${current.id} and ${incomingSet.id} for placement ${placementId}.`,
      );
    }
  }
}

export function requireGroupRepublishForCompositionChange(
  draftRevision: GroupRevisionSnapshot,
  publishedRevision?: GroupRevisionSnapshot,
): void {
  if (!publishedRevision) return;

  if (!sameMembers(draftRevision.storyIds, publishedRevision.storyIds)) {
    throw new PublishConflictError(
      'Group composition changed (stories added/removed/reordered). Group must be republished before changes can go live.',
    );
  }
}

export function requireSetRepublishForCompositionOrConfigChange(
  draftRevision: SetRevisionSnapshot,
  publishedRevision?: SetRevisionSnapshot,
): void {
  if (!publishedRevision) return;

  const groupsChanged = !sameMembers(draftRevision.storyGroupIds, publishedRevision.storyGroupIds);
  const platformsChanged = !samePlatformTargets(draftRevision.platformTargets, publishedRevision.platformTargets);
  const segmentsChanged = !sameMembers(draftRevision.userSegments, publishedRevision.userSegments);
  const fallbackChanged = draftRevision.isFallback !== publishedRevision.isFallback;

  if (groupsChanged || platformsChanged || segmentsChanged || fallbackChanged) {
    throw new PublishConflictError(
      'Set composition/config changed (group list, targeting, or fallback flag). Set must be republished before changes can go live.',
    );
  }
}

function isAmbiguousTargetingPair(a: TargetingRule, b: TargetingRule): boolean {
  const overlappingPlatforms = intersectPlatforms(a.platformTargets, b.platformTargets);
  if (overlappingPlatforms.length === 0) return false;

  const segmentAmbiguous = areSegmentsAmbiguous(a.userSegments, b.userSegments);
  if (!segmentAmbiguous) return false;

  const aCount = a.platformTargets.length;
  const bCount = b.platformTargets.length;
  const samePlatformSpecificity = aCount === bCount;

  // If platform specificity differs, deterministic priority exists.
  if (!samePlatformSpecificity) return false;

  const highestA = highestMinVersionForOverlap(a.platformTargets, overlappingPlatforms);
  const highestB = highestMinVersionForOverlap(b.platformTargets, overlappingPlatforms);

  // Same compatible min version + same platform specificity + segment ambiguity => conflict.
  return compareVersions(highestA, highestB) === 0;
}

function intersectPlatforms(a: PlatformTarget[], b: PlatformTarget[]): Platform[] {
  const aSet = new Set(a.map((it) => it.platform));
  return b.map((it) => it.platform).filter((p): p is Platform => aSet.has(p));
}

function areSegmentsAmbiguous(a: string[], b: string[]): boolean {
  if (a.length === 0 && b.length === 0) return true;
  if (a.length === 0 || b.length === 0) return false;

  const overlap = a.filter((segment) => b.includes(segment));
  if (overlap.length === 0) return false;

  const sameSize = a.length === b.length;
  const aSubsetB = a.every((segment) => b.includes(segment));
  const bSubsetA = b.every((segment) => a.includes(segment));

  // deterministic only when one side is strictly narrower.
  if (!sameSize && (aSubsetB || bSubsetA)) return false;

  return true;
}

function highestMinVersionForOverlap(targets: PlatformTarget[], platforms: Platform[]): string {
  const overlapTargets = targets.filter((target) => platforms.includes(target.platform));
  return overlapTargets.reduce((max, target) => (compareVersions(target.minAppVersion, max) > 0 ? target.minAppVersion : max), '0.0.0');
}

function samePlatformTargets(a: PlatformTarget[], b: PlatformTarget[]): boolean {
  if (a.length !== b.length) return false;

  const sortKey = (target: PlatformTarget) => `${target.platform}:${normalizeVersion(target.minAppVersion)}`;
  const sortedA = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  const sortedB = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));

  return sortedA.every((item, i) => sortKey(item) === sortKey(sortedB[i]));
}

function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function normalizeVersion(version: string): string {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return `${Number(major)}.${Number(minor)}.${Number(patch)}`;
}

function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a).split('.').map(Number);
  const right = normalizeVersion(b).split('.').map(Number);

  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }

  return 0;
}
