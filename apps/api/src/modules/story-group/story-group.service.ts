import { randomUUID } from 'node:crypto';

import { adminGroup } from '@open-story/contracts';
import type {
  ArchiveStoryGroupDto,
  CreateStoryGroupDto,
  PublishStoryGroupDto,
  StoryGroupDto,
  StoryGroupRevisionRecord,
  StoryGroupRootRecord,
  UpdateStoryGroupDto,
} from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { PublishResolutionService } from '../../publish/publish-resolution.service.ts';
import { toAdminGroupDto } from '../../story-content/story-content.mappers.ts';
import { StoryContentRepository } from '../../story-content/story-content.repository.ts';

export class StoryGroupService {
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

  async list(authorization?: string): Promise<StoryGroupDto[]> {
    await this.adminAccessService.requireAdminAccess(authorization);

    return this.repository
      .listGroupRoots()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((root) => this.toDto(root));
  }

  async get(groupId: string, authorization?: string): Promise<StoryGroupDto> {
    await this.adminAccessService.requireAdminAccess(authorization);
    return this.toDto(this.getGroupRootOrThrow(groupId));
  }

  async create(payload: CreateStoryGroupDto, authorization?: string): Promise<StoryGroupDto> {
    const access = await this.adminAccessService.requireAdminAccess(authorization);
    const parsedPayload = adminGroup.createStoryGroupDtoSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Story group payload is invalid.');
    }

    const normalizedPayload = this.normalizeDraftPayload(parsedPayload.data);
    this.validateDraftPayload(normalizedPayload);

    const now = new Date().toISOString();
    const groupId = randomUUID();
    const draftRevisionId = randomUUID();
    const root: StoryGroupRootRecord = {
      id: groupId,
      name: normalizedPayload.name,
      isArchived: false,
      currentDraftRevisionId: draftRevisionId,
      currentPublishedRevisionId: null,
      createdAt: now,
      updatedAt: now,
    };
    const draftRevision: StoryGroupRevisionRecord = {
      id: draftRevisionId,
      storyGroupId: groupId,
      revisionNumber: 1,
      name: normalizedPayload.name,
      bottomLabel: normalizedPayload.bottomLabel,
      logoAssetId: normalizedPayload.logoAssetId,
      badge: normalizedPayload.badge,
      status: 'draft',
      createdByAdminUserId: access.adminUserId,
      createdAt: now,
    };

    this.repository.createGroupRoot(root);
    this.repository.createGroupRevision(draftRevision);
    this.repository.replaceGroupRevisionStories(draftRevision.id, normalizedPayload.storyIds, now);

    return this.toDto(root);
  }

  async update(
    groupId: string,
    payload: UpdateStoryGroupDto,
    authorization?: string,
  ): Promise<StoryGroupDto> {
    const access = await this.adminAccessService.requireAdminAccess(authorization);
    const parsedPayload = adminGroup.updateStoryGroupDtoSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Story group payload is invalid.');
    }

    if (Object.keys(parsedPayload.data).length === 0) {
      throw ApiServiceError.badRequest('At least one story group field must be provided.');
    }

    const existingRoot = this.getGroupRootOrThrow(groupId);
    const existingDraftRevision = this.getDraftRevision(existingRoot);
    const existingStoryIds = this.repository
      .listGroupRevisionStories(existingRoot.currentDraftRevisionId)
      .map((record) => record.storyId);

    const normalizedPayload = this.normalizeDraftPayload({
      name: parsedPayload.data.name ?? existingDraftRevision.name,
      bottom_label: parsedPayload.data.bottom_label ?? existingDraftRevision.bottomLabel,
      logo_asset_id: parsedPayload.data.logo_asset_id ?? existingDraftRevision.logoAssetId,
      badge: parsedPayload.data.badge ?? existingDraftRevision.badge,
      story_ids: parsedPayload.data.story_ids ?? existingStoryIds,
    });

    this.validateDraftPayload(normalizedPayload, existingRoot.id);
    this.ensureStoriesRemainAssigned(existingStoryIds, normalizedPayload.storyIds);

    const hasDraftChanges =
      normalizedPayload.name !== existingDraftRevision.name ||
      normalizedPayload.bottomLabel !== existingDraftRevision.bottomLabel ||
      normalizedPayload.logoAssetId !== existingDraftRevision.logoAssetId ||
      !areBadgesEqual(normalizedPayload.badge, existingDraftRevision.badge) ||
      !areStringArraysEqual(normalizedPayload.storyIds, existingStoryIds);

    if (!hasDraftChanges) {
      return this.toDto(existingRoot);
    }

    const now = new Date().toISOString();
    const nextDraftRevisionId = randomUUID();
    const nextRevision: StoryGroupRevisionRecord = {
      id: nextDraftRevisionId,
      storyGroupId: existingRoot.id,
      revisionNumber: this.nextGroupRevisionNumber(existingRoot.id),
      name: normalizedPayload.name,
      bottomLabel: normalizedPayload.bottomLabel,
      logoAssetId: normalizedPayload.logoAssetId,
      badge: normalizedPayload.badge,
      status: 'draft',
      createdByAdminUserId: access.adminUserId,
      createdAt: now,
    };

    this.repository.createGroupRevision(nextRevision);
    this.repository.replaceGroupRevisionStories(nextRevision.id, normalizedPayload.storyIds, now);

    const updatedRoot = this.repository.updateGroupRoot(existingRoot.id, {
      name: normalizedPayload.name,
      currentDraftRevisionId: nextDraftRevisionId,
      updatedAt: now,
    });

    if (!updatedRoot) {
      throw ApiServiceError.notFound('Story group not found.');
    }

    return this.toDto(updatedRoot);
  }

  async publish(
    groupId: string,
    payload: PublishStoryGroupDto | undefined,
    authorization?: string,
  ): Promise<StoryGroupDto> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const parsedPayload = adminGroup.publishStoryGroupDtoSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Publish payload is invalid.');
    }

    const publishedRoot = this.publishResolutionService.publishGroup({
      groupId,
      expectedDraftRevisionId: parsedPayload.data.expected_draft_revision_id,
    });

    return this.toDto(publishedRoot);
  }

  async archive(
    groupId: string,
    payload: ArchiveStoryGroupDto,
    authorization?: string,
  ): Promise<StoryGroupDto> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const parsedPayload = adminGroup.archiveStoryGroupDtoSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Archive payload is invalid.');
    }

    const root = this.getGroupRootOrThrow(groupId);
    const updatedRoot = this.repository.updateGroupRoot(root.id, {
      isArchived: parsedPayload.data.archived,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedRoot) {
      throw ApiServiceError.notFound('Story group not found.');
    }

    return this.toDto(updatedRoot);
  }

  private toDto(root: StoryGroupRootRecord): StoryGroupDto {
    const draftRevision = this.getDraftRevision(root);
    const storyIds = this.repository
      .listGroupRevisionStories(root.currentDraftRevisionId)
      .map((record) => record.storyId);

    return toAdminGroupDto(root, draftRevision, storyIds);
  }

  private getGroupRootOrThrow(groupId: string): StoryGroupRootRecord {
    const root = this.repository.findGroupRootById(groupId);
    if (!root) {
      throw ApiServiceError.notFound('Story group not found.');
    }

    return root;
  }

  private getDraftRevision(root: StoryGroupRootRecord): StoryGroupRevisionRecord {
    const revision = this.repository.findGroupRevisionById(root.currentDraftRevisionId);
    if (!revision || revision.storyGroupId !== root.id) {
      throw ApiServiceError.conflict(`Draft revision ${root.currentDraftRevisionId} is invalid for group ${root.id}.`);
    }

    return revision;
  }

  private nextGroupRevisionNumber(groupId: string): number {
    return (
      this.repository
        .listGroupRevisionsByGroupId(groupId)
        .reduce((maxValue, record) => Math.max(maxValue, record.revisionNumber), 0) + 1
    );
  }

  private validateDraftPayload(payload: NormalizedGroupDraftPayload, currentGroupId?: string): void {
    const logoAsset = this.repository.findAssetById(payload.logoAssetId);
    if (!logoAsset || logoAsset.kind !== 'group_logo') {
      throw ApiServiceError.badRequest('logo_asset_id must reference an uploaded group logo asset.');
    }
    if (logoAsset.mediaType !== 'image') {
      throw ApiServiceError.badRequest('logo_asset_id must reference an image asset.');
    }

    for (const storyId of payload.storyIds) {
      if (!this.repository.findStoryRootById(storyId)) {
        throw ApiServiceError.notFound(`Story ${storyId} not found.`);
      }

      const draftGroupIds = this.repository.findDraftGroupIdsForStory(storyId);
      if (draftGroupIds.some((groupId) => groupId !== currentGroupId)) {
        throw ApiServiceError.conflict(`Story ${storyId} is already assigned to another group draft.`);
      }
    }
  }

  private normalizeDraftPayload(payload: CreateStoryGroupDto): NormalizedGroupDraftPayload {
    return {
      name: payload.name,
      bottomLabel: payload.bottom_label ?? null,
      logoAssetId: payload.logo_asset_id,
      badge: payload.badge ?? null,
      storyIds: normalizeUniqueStrings(payload.story_ids),
    };
  }

  private ensureStoriesRemainAssigned(previousStoryIds: string[], nextStoryIds: string[]): void {
    const nextStoryIdSet = new Set(nextStoryIds);

    for (const storyId of previousStoryIds) {
      if (nextStoryIdSet.has(storyId)) {
        continue;
      }

      if (this.repository.findPublishedGroupIdsForStory(storyId).length === 0) {
        throw ApiServiceError.conflict(
          `Story ${storyId} cannot be removed from its only assigned group draft before it is published elsewhere.`,
        );
      }
    }
  }
}

type NormalizedGroupDraftPayload = {
  name: string;
  bottomLabel: string | null;
  logoAssetId: string;
  badge: { type: 'emoji' | 'svg'; value: string } | null;
  storyIds: string[];
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

function areBadgesEqual(
  left: { type: 'emoji' | 'svg'; value: string } | null,
  right: { type: 'emoji' | 'svg'; value: string } | null,
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.type === right.type && left.value === right.value;
}
