import { randomUUID } from 'node:crypto';

import { adminSet } from '@open-story/contracts';
import type {
  CreateStoryGroupSetDto,
  PublishStoryGroupSetDto,
  StoryGroupSetDto,
  StoryGroupSetRevisionRecord,
  StoryGroupSetRootRecord,
  UpdateStoryGroupSetDto,
} from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { PublishResolutionService } from '../../publish/publish-resolution.service.ts';
import { toAdminSetDto } from '../../story-content/story-content.mappers.ts';
import { StoryContentRepository } from '../../story-content/story-content.repository.ts';

type NormalizedTarget = {
  platform: 'ios' | 'android';
  minAppVersion: string;
};

export class StoryGroupSetService {
  private readonly repository: StoryContentRepository;
  private readonly publishResolutionService: PublishResolutionService;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    repository: StoryContentRepository,
    publishResolutionService: PublishResolutionService,
    adminAccessService: AdminAccessService,
  ) {
    this.repository = repository;
    this.publishResolutionService = publishResolutionService;
    this.adminAccessService = adminAccessService;
  }

  async list(authorization?: string): Promise<StoryGroupSetDto[]> {
    await this.adminAccessService.requireStoryEditorAccess(authorization);

    return this.repository
      .listSetRoots()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((root) => this.toDto(root));
  }

  async get(setId: string, authorization?: string): Promise<StoryGroupSetDto> {
    await this.adminAccessService.requireStoryEditorAccess(authorization);
    return this.toDto(this.getSetRootOrThrow(setId));
  }

  async create(payload: CreateStoryGroupSetDto, authorization?: string): Promise<StoryGroupSetDto> {
    const access = await this.adminAccessService.requireContentAdminAccess(authorization);
    const parsedPayload = adminSet.createStoryGroupSetDtoSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Story group set payload is invalid.');
    }

    const normalizedPayload = this.normalizeDraftPayload(parsedPayload.data);
    this.validateDraftPayload(normalizedPayload);

    const now = new Date().toISOString();
    const setId = randomUUID();
    const draftRevisionId = randomUUID();
    const root: StoryGroupSetRootRecord = {
      id: setId,
      placementId: normalizedPayload.placementId,
      name: normalizedPayload.name,
      isFallback: normalizedPayload.isFallback,
      isArchived: false,
      currentDraftRevisionId: draftRevisionId,
      currentPublishedRevisionId: null,
      createdAt: now,
      updatedAt: now,
    };
    const draftRevision: StoryGroupSetRevisionRecord = {
      id: draftRevisionId,
      storyGroupSetId: setId,
      revisionNumber: 1,
      name: normalizedPayload.name,
      status: 'draft',
      platformTargets: normalizedPayload.targets,
      userSegments: normalizedPayload.segments,
      createdByAdminUserId: access.adminUserId,
      createdAt: now,
    };

    this.repository.createSetRoot(root);
    this.repository.createSetRevision(draftRevision);
    this.repository.replaceSetRevisionGroups(draftRevision.id, normalizedPayload.groupIds, now);

    return this.toDto(root);
  }

  async update(
    setId: string,
    payload: UpdateStoryGroupSetDto,
    authorization?: string,
  ): Promise<StoryGroupSetDto> {
    const access = await this.adminAccessService.requireContentAdminAccess(authorization);
    const parsedPayload = adminSet.updateStoryGroupSetDtoSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Story group set payload is invalid.');
    }

    if (Object.keys(parsedPayload.data).length === 0) {
      throw ApiServiceError.badRequest('At least one story group set field must be provided.');
    }

    const existingRoot = this.getSetRootOrThrow(setId);
    const existingDraftRevision = this.getDraftRevision(existingRoot);
    const existingGroupIds = this.repository
      .listSetRevisionGroups(existingRoot.currentDraftRevisionId)
      .map((record) => record.storyGroupId);

    const normalizedPayload = this.normalizeDraftPayload({
      placement_id: parsedPayload.data.placement_id ?? existingRoot.placementId,
      name: parsedPayload.data.name ?? existingDraftRevision.name,
      is_fallback: parsedPayload.data.is_fallback ?? existingRoot.isFallback,
      targets:
        parsedPayload.data.targets ??
        existingDraftRevision.platformTargets.map((target) => ({
          platform: target.platform,
          min_app_version: target.minAppVersion,
        })),
      segments: parsedPayload.data.segments ?? existingDraftRevision.userSegments,
      group_ids: parsedPayload.data.group_ids ?? existingGroupIds,
    });

    if (
      existingRoot.currentPublishedRevisionId &&
      (normalizedPayload.placementId !== existingRoot.placementId || normalizedPayload.isFallback !== existingRoot.isFallback)
    ) {
      throw ApiServiceError.conflict(
        'Published set placement and fallback changes are not yet revisioned. Create a new set instead.',
      );
    }

    this.validateDraftPayload(normalizedPayload);

    const hasDraftChanges =
      normalizedPayload.name !== existingDraftRevision.name ||
      !areTargetsEqual(normalizedPayload.targets, existingDraftRevision.platformTargets) ||
      !areStringArraysEqual(normalizedPayload.segments, existingDraftRevision.userSegments) ||
      !areStringArraysEqual(normalizedPayload.groupIds, existingGroupIds);

    const now = new Date().toISOString();
    let nextDraftRevisionId = existingRoot.currentDraftRevisionId;

    if (hasDraftChanges) {
      nextDraftRevisionId = randomUUID();
      const nextRevision: StoryGroupSetRevisionRecord = {
        id: nextDraftRevisionId,
        storyGroupSetId: existingRoot.id,
        revisionNumber: this.nextSetRevisionNumber(existingRoot.id),
        name: normalizedPayload.name,
        status: 'draft',
        platformTargets: normalizedPayload.targets,
        userSegments: normalizedPayload.segments,
        createdByAdminUserId: access.adminUserId,
        createdAt: now,
      };

      this.repository.createSetRevision(nextRevision);
      this.repository.replaceSetRevisionGroups(nextRevision.id, normalizedPayload.groupIds, now);
    }

    const updatedRoot = this.repository.updateSetRoot(existingRoot.id, {
      placementId: normalizedPayload.placementId,
      name: normalizedPayload.name,
      isFallback: normalizedPayload.isFallback,
      currentDraftRevisionId: nextDraftRevisionId,
      updatedAt: now,
    });

    if (!updatedRoot) {
      throw ApiServiceError.notFound('Story group set not found.');
    }

    return this.toDto(updatedRoot);
  }

  async publish(
    setId: string,
    payload: PublishStoryGroupSetDto | undefined,
    authorization?: string,
  ): Promise<StoryGroupSetDto> {
    await this.adminAccessService.requireContentAdminAccess(authorization);

    const parsedPayload = adminSet.publishStoryGroupSetDtoSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Publish payload is invalid.');
    }

    const publishedRoot = this.publishResolutionService.publishSet({
      setId,
      expectedDraftRevisionId: parsedPayload.data.expected_draft_revision_id,
    });

    return this.toDto(publishedRoot);
  }

  private toDto(root: StoryGroupSetRootRecord): StoryGroupSetDto {
    const draftRevision = this.getDraftRevision(root);
    const groupIds = this.repository
      .listSetRevisionGroups(root.currentDraftRevisionId)
      .map((record) => record.storyGroupId);

    return toAdminSetDto(root, draftRevision, groupIds);
  }

  private getSetRootOrThrow(setId: string): StoryGroupSetRootRecord {
    const root = this.repository.findSetRootById(setId);
    if (!root) {
      throw ApiServiceError.notFound('Story group set not found.');
    }

    return root;
  }

  private getDraftRevision(root: StoryGroupSetRootRecord): StoryGroupSetRevisionRecord {
    const revision = this.repository.findSetRevisionById(root.currentDraftRevisionId);
    if (!revision || revision.storyGroupSetId !== root.id) {
      throw ApiServiceError.conflict(`Draft revision ${root.currentDraftRevisionId} is invalid for set ${root.id}.`);
    }

    return revision;
  }

  private nextSetRevisionNumber(setId: string): number {
    return (
      this.repository
        .listSetRevisionsBySetId(setId)
        .reduce((maxValue, record) => Math.max(maxValue, record.revisionNumber), 0) + 1
    );
  }

  private validateDraftPayload(payload: NormalizedSetDraftPayload): void {
    if (!this.repository.findPlacementById(payload.placementId)) {
      throw ApiServiceError.notFound('Placement not found.');
    }

    for (const groupId of payload.groupIds) {
      if (!this.repository.findGroupRootById(groupId)) {
        throw ApiServiceError.notFound(`Story group ${groupId} not found.`);
      }
    }

    if (payload.isFallback) {
      if (payload.targets.length > 0 || payload.segments.length > 0) {
        throw ApiServiceError.badRequest('Fallback set cannot have targets or segments.');
      }

      return;
    }

    if (payload.targets.length === 0) {
      throw ApiServiceError.badRequest('Non-fallback set must target at least one platform.');
    }
  }

  private normalizeDraftPayload(payload: CreateStoryGroupSetDto): NormalizedSetDraftPayload {
    const targetMap = new Map<string, NormalizedTarget>();
    for (const target of payload.targets) {
      targetMap.set(target.platform, {
        platform: target.platform,
        minAppVersion: target.min_app_version,
      });
    }

    return {
      placementId: payload.placement_id,
      name: payload.name,
      isFallback: payload.is_fallback,
      targets: Array.from(targetMap.values()).sort((left, right) => left.platform.localeCompare(right.platform)),
      segments: normalizeUniqueStrings(payload.segments),
      groupIds: normalizeUniqueStrings(payload.group_ids),
    };
  }
}

type NormalizedSetDraftPayload = {
  placementId: string;
  name: string;
  isFallback: boolean;
  targets: NormalizedTarget[];
  segments: string[];
  groupIds: string[];
};

function normalizeUniqueStrings(values: string[]): string[] {
  const result: string[] = [];
  const seenValues = new Set<string>();

  for (const value of values) {
    if (seenValues.has(value)) {
      continue;
    }

    seenValues.add(value);
    result.push(value);
  }

  return result;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areTargetsEqual(
  left: NormalizedTarget[],
  right: Array<{ platform: string; minAppVersion: string }>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (target, index) =>
      target.platform === right[index]?.platform && target.minAppVersion === right[index]?.minAppVersion,
  );
}
