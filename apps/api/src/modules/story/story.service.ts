import { randomUUID } from 'node:crypto';

import { adminStory } from '@open-story/contracts';
import type {
  ArchiveStoryDto,
  CreateStoryDto,
  PublishStoryDto,
  StoryDto,
  StoryGroupRevisionRecord,
  StoryGroupRootRecord,
  StoryRevisionRecord,
  StoryRootRecord,
  UpdateStoryDto,
} from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { PublishResolutionService } from '../../publish/publish-resolution.service.ts';
import { toAdminStoryDto } from '../../story-content/story-content.mappers.ts';
import { StoryContentRepository } from '../../story-content/story-content.repository.ts';

export class StoryService {
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

  async list(authorization?: string): Promise<StoryDto[]> {
    await this.adminAccessService.requireAdminAccess(authorization);

    return this.repository
      .listStoryRoots()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((root) => this.toDto(root));
  }

  async get(storyId: string, authorization?: string): Promise<StoryDto> {
    await this.adminAccessService.requireAdminAccess(authorization);
    return this.toDto(this.getStoryRootOrThrow(storyId));
  }

  async create(payload: CreateStoryDto, authorization?: string): Promise<StoryDto> {
    const access = await this.adminAccessService.requireAdminAccess(authorization);
    const parsedPayload = adminStory.createStoryDtoSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Story payload is invalid.');
    }

    const normalizedPayload = this.normalizeDraftPayload(parsedPayload.data);
    this.validateDraftPayload(normalizedPayload);

    const targetGroup = this.getGroupRootOrThrow(normalizedPayload.groupId);
    const now = new Date().toISOString();
    const storyId = randomUUID();
    const draftRevisionId = randomUUID();
    const root: StoryRootRecord = {
      id: storyId,
      name: normalizedPayload.name,
      isArchived: false,
      currentDraftRevisionId: draftRevisionId,
      currentPublishedRevisionId: null,
      createdAt: now,
      updatedAt: now,
    };
    const draftRevision: StoryRevisionRecord = {
      id: draftRevisionId,
      storyId,
      revisionNumber: 1,
      name: normalizedPayload.name,
      mediaType: normalizedPayload.mediaType,
      assetId: normalizedPayload.assetId,
      posterAssetId: normalizedPayload.posterAssetId,
      imageDurationMs: normalizedPayload.imageDurationMs,
      cta: normalizedPayload.cta,
      status: 'draft',
      createdByAdminUserId: access.adminUserId,
      createdAt: now,
    };

    this.repository.createStoryRoot(root);
    this.repository.createStoryRevision(draftRevision);
    this.appendStoryToGroupDraft(targetGroup, storyId, access.adminUserId, now);

    return this.toDto(root);
  }

  async update(
    storyId: string,
    payload: UpdateStoryDto,
    authorization?: string,
  ): Promise<StoryDto> {
    const access = await this.adminAccessService.requireAdminAccess(authorization);
    const parsedPayload = adminStory.updateStoryDtoSchema.safeParse(payload);

    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Story payload is invalid.');
    }

    if (Object.keys(parsedPayload.data).length === 0) {
      throw ApiServiceError.badRequest('At least one story field must be provided.');
    }

    const existingRoot = this.getStoryRootOrThrow(storyId);
    const existingDraftRevision = this.getDraftRevision(existingRoot);
    const groupId = this.resolveGroupIdForStory(existingRoot.id);
    const normalizedPayload = this.normalizeDraftPayload({
      group_id: groupId,
      name: parsedPayload.data.name ?? existingDraftRevision.name,
      media_type: parsedPayload.data.media_type ?? existingDraftRevision.mediaType,
      asset_id: parsedPayload.data.asset_id ?? existingDraftRevision.assetId,
      poster_asset_id:
        parsedPayload.data.poster_asset_id === undefined
          ? existingDraftRevision.posterAssetId
          : parsedPayload.data.poster_asset_id,
      image_duration_ms:
        parsedPayload.data.image_duration_ms === undefined
          ? existingDraftRevision.imageDurationMs
          : parsedPayload.data.image_duration_ms,
      cta: parsedPayload.data.cta === undefined ? existingDraftRevision.cta : parsedPayload.data.cta,
    });

    this.validateDraftPayload(normalizedPayload);

    const hasDraftChanges =
      normalizedPayload.name !== existingDraftRevision.name ||
      normalizedPayload.mediaType !== existingDraftRevision.mediaType ||
      normalizedPayload.assetId !== existingDraftRevision.assetId ||
      normalizedPayload.posterAssetId !== existingDraftRevision.posterAssetId ||
      normalizedPayload.imageDurationMs !== existingDraftRevision.imageDurationMs ||
      !areCtasEqual(normalizedPayload.cta, existingDraftRevision.cta);

    if (!hasDraftChanges) {
      return this.toDto(existingRoot);
    }

    const now = new Date().toISOString();
    const nextDraftRevisionId = randomUUID();
    const nextRevision: StoryRevisionRecord = {
      id: nextDraftRevisionId,
      storyId: existingRoot.id,
      revisionNumber: this.nextStoryRevisionNumber(existingRoot.id),
      name: normalizedPayload.name,
      mediaType: normalizedPayload.mediaType,
      assetId: normalizedPayload.assetId,
      posterAssetId: normalizedPayload.posterAssetId,
      imageDurationMs: normalizedPayload.imageDurationMs,
      cta: normalizedPayload.cta,
      status: 'draft',
      createdByAdminUserId: access.adminUserId,
      createdAt: now,
    };

    this.repository.createStoryRevision(nextRevision);
    const updatedRoot = this.repository.updateStoryRoot(existingRoot.id, {
      name: normalizedPayload.name,
      currentDraftRevisionId: nextDraftRevisionId,
      updatedAt: now,
    });

    if (!updatedRoot) {
      throw ApiServiceError.notFound('Story not found.');
    }

    return this.toDto(updatedRoot);
  }

  async publish(
    storyId: string,
    payload: PublishStoryDto | undefined,
    authorization?: string,
  ): Promise<StoryDto> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const parsedPayload = adminStory.publishStoryDtoSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Publish payload is invalid.');
    }

    const publishedRoot = this.publishResolutionService.publishStory({
      storyId,
      expectedDraftRevisionId: parsedPayload.data.expected_draft_revision_id,
    });

    return this.toDto(publishedRoot);
  }

  async archive(
    storyId: string,
    payload: ArchiveStoryDto,
    authorization?: string,
  ): Promise<StoryDto> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const parsedPayload = adminStory.archiveStoryDtoSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw ApiServiceError.badRequest(parsedPayload.error.issues[0]?.message ?? 'Archive payload is invalid.');
    }

    const root = this.getStoryRootOrThrow(storyId);
    const updatedRoot = this.repository.updateStoryRoot(root.id, {
      isArchived: parsedPayload.data.archived,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedRoot) {
      throw ApiServiceError.notFound('Story not found.');
    }

    return this.toDto(updatedRoot);
  }

  private toDto(root: StoryRootRecord): StoryDto {
    const draftRevision = this.getDraftRevision(root);
    const groupId = this.resolveGroupIdForStory(root.id);

    return toAdminStoryDto(root, draftRevision, groupId);
  }

  private appendStoryToGroupDraft(
    groupRoot: StoryGroupRootRecord,
    storyId: string,
    adminUserId: string | null,
    now: string,
  ): void {
    const draftRevision = this.getGroupDraftRevision(groupRoot);
    const storyIds = this.repository
      .listGroupRevisionStories(draftRevision.id)
      .map((record) => record.storyId);
    const nextStoryIds = [...storyIds, storyId];
    const nextDraftRevisionId = randomUUID();
    const nextRevision: StoryGroupRevisionRecord = {
      id: nextDraftRevisionId,
      storyGroupId: groupRoot.id,
      revisionNumber: this.nextGroupRevisionNumber(groupRoot.id),
      name: draftRevision.name,
      bottomLabel: draftRevision.bottomLabel,
      logoAssetId: draftRevision.logoAssetId,
      badge: draftRevision.badge,
      status: 'draft',
      createdByAdminUserId: adminUserId,
      createdAt: now,
    };

    this.repository.createGroupRevision(nextRevision);
    this.repository.replaceGroupRevisionStories(nextRevision.id, nextStoryIds, now);
    this.repository.updateGroupRoot(groupRoot.id, {
      name: draftRevision.name,
      currentDraftRevisionId: nextDraftRevisionId,
      updatedAt: now,
    });
  }

  private getStoryRootOrThrow(storyId: string): StoryRootRecord {
    const root = this.repository.findStoryRootById(storyId);
    if (!root) {
      throw ApiServiceError.notFound('Story not found.');
    }

    return root;
  }

  private getGroupRootOrThrow(groupId: string): StoryGroupRootRecord {
    const root = this.repository.findGroupRootById(groupId);
    if (!root) {
      throw ApiServiceError.notFound('Story group not found.');
    }

    return root;
  }

  private getDraftRevision(root: StoryRootRecord): StoryRevisionRecord {
    const revision = this.repository.findStoryRevisionById(root.currentDraftRevisionId);
    if (!revision || revision.storyId !== root.id) {
      throw ApiServiceError.conflict(`Draft revision ${root.currentDraftRevisionId} is invalid for story ${root.id}.`);
    }

    return revision;
  }

  private getGroupDraftRevision(root: StoryGroupRootRecord): StoryGroupRevisionRecord {
    const revision = this.repository.findGroupRevisionById(root.currentDraftRevisionId);
    if (!revision || revision.storyGroupId !== root.id) {
      throw ApiServiceError.conflict(`Draft revision ${root.currentDraftRevisionId} is invalid for group ${root.id}.`);
    }

    return revision;
  }

  private resolveGroupIdForStory(storyId: string): string {
    const draftGroupIds = this.repository.findDraftGroupIdsForStory(storyId);
    if (draftGroupIds.length > 1) {
      throw ApiServiceError.conflict(`Story ${storyId} is assigned to multiple group drafts.`);
    }
    if (draftGroupIds.length === 1) {
      return draftGroupIds[0];
    }

    const publishedGroupIds = this.repository.findPublishedGroupIdsForStory(storyId);
    if (publishedGroupIds.length > 1) {
      throw ApiServiceError.conflict(`Story ${storyId} is assigned to multiple published groups.`);
    }
    if (publishedGroupIds.length === 1) {
      return publishedGroupIds[0];
    }

    throw ApiServiceError.conflict(`Story ${storyId} is not assigned to any story group.`);
  }

  private nextStoryRevisionNumber(storyId: string): number {
    return (
      this.repository
        .listStoryRevisionsByStoryId(storyId)
        .reduce((maxValue, record) => Math.max(maxValue, record.revisionNumber), 0) + 1
    );
  }

  private nextGroupRevisionNumber(groupId: string): number {
    return (
      this.repository
        .listGroupRevisionsByGroupId(groupId)
        .reduce((maxValue, record) => Math.max(maxValue, record.revisionNumber), 0) + 1
    );
  }

  private validateDraftPayload(payload: NormalizedStoryDraftPayload): void {
    this.getGroupRootOrThrow(payload.groupId);

    const asset = this.repository.findAssetById(payload.assetId);
    if (!asset) {
      throw ApiServiceError.notFound('Story asset not found.');
    }

    if (payload.mediaType === 'image') {
      if (asset.kind !== 'story_image') {
        throw ApiServiceError.badRequest('Image story must reference a story_image asset.');
      }
      if (asset.mediaType !== 'image') {
        throw ApiServiceError.badRequest('Image story asset must be an image.');
      }
      if (payload.posterAssetId) {
        throw ApiServiceError.badRequest('Image story cannot define poster_asset_id.');
      }
      return;
    }

    if (asset.kind !== 'story_video') {
      throw ApiServiceError.badRequest('Video story must reference a story_video asset.');
    }
    if (asset.mediaType !== 'video') {
      throw ApiServiceError.badRequest('Video story asset must be a video.');
    }
    if (payload.imageDurationMs !== null) {
      throw ApiServiceError.badRequest('Video story cannot define image_duration_ms.');
    }

    if (!payload.posterAssetId) {
      throw ApiServiceError.badRequest('Video story requires poster_asset_id.');
    }

    const posterAsset = this.repository.findAssetById(payload.posterAssetId);
    if (!posterAsset || posterAsset.kind !== 'story_video_poster') {
      throw ApiServiceError.badRequest('Video story poster_asset_id must reference a story_video_poster asset.');
    }
    if (posterAsset.mediaType !== 'image') {
      throw ApiServiceError.badRequest('Video story poster asset must be an image.');
    }
  }

  private normalizeDraftPayload(payload: CreateStoryDto): NormalizedStoryDraftPayload {
    return {
      groupId: payload.group_id,
      name: payload.name,
      mediaType: payload.media_type,
      assetId: payload.asset_id,
      posterAssetId: payload.poster_asset_id ?? null,
      imageDurationMs: payload.image_duration_ms ?? null,
      cta: payload.cta ?? null,
    };
  }
}

type NormalizedStoryDraftPayload = {
  groupId: string;
  name: string;
  mediaType: 'image' | 'video';
  assetId: string;
  posterAssetId: string | null;
  imageDurationMs: number | null;
  cta: { label: string; type: 'url' | 'deeplink'; value: string } | null;
};

function areCtasEqual(
  left: { label: string; type: 'url' | 'deeplink'; value: string } | null,
  right: { label: string; type: 'url' | 'deeplink'; value: string } | null,
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.label === right.label && left.type === right.type && left.value === right.value;
}
