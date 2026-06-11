import type { AssetDto, AssetRecord, CreateAssetFromUrlDto, ListAssetsQueryDto } from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { ApiServiceError } from '../../common/filters/api-error.ts';
import { AssetStorageSettingsStore } from '../settings/asset-storage-settings.store.ts';
import { AssetsRepository } from './assets.repository.ts';
import {
  createAssetRecordFromCloudUpload,
  createAssetRecordFromUpload,
  createAssetRecordFromUrlImport,
  deleteAssetBinary,
  type AssetUploadInput,
} from './asset-upload.ts';
import { createGcsAssetUploadTarget, deleteGcsAssetBinary } from './gcs-asset-storage.ts';
import {
  createSupabaseS3AssetUploadTarget,
  deleteSupabaseS3AssetBinary,
} from './supabase-s3-asset-storage.ts';

export class AssetsService {
  private readonly repository: AssetsRepository;
  private readonly adminAccessService: AdminAccessService;
  private readonly assetStorageSettingsStore: AssetStorageSettingsStore;

  constructor(
    repository: AssetsRepository,
    adminAccessService: AdminAccessService,
    assetStorageSettingsStore: AssetStorageSettingsStore,
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
    this.assetStorageSettingsStore = assetStorageSettingsStore;
  }

  async list(query: ListAssetsQueryDto, authorization?: string): Promise<AssetDto[]> {
    await this.adminAccessService.requireStoryEditorAccess(authorization);

    const records = this.repository
      .list()
      .filter((record) => (query.type ? toAssetDtoType(record.kind) === query.type : true));
    const usageByAssetId =
      query.includeUsage === false
        ? new Map<string, AssetDto['usageReferences']>()
        : this.repository.listCurrentUsageByAssetId(records.map((record) => record.id));

    return records
      .map((record) => toAssetDto(record, usageByAssetId.get(record.id) ?? []));
  }

  async getUploadCapabilities(authorization?: string): Promise<{ serverUploadAllowed: boolean }> {
    await this.adminAccessService.requireStoryEditorAccess(authorization);
    const settings = this.assetStorageSettingsStore.getSettings();

    return {
      serverUploadAllowed: settings.activeProvider === 'local',
    };
  }

  async upload(input: Omit<AssetUploadInput, 'createdByAdminUserId'>, authorization?: string): Promise<AssetDto> {
    const access = await this.adminAccessService.requireStoryEditorAccess(authorization);
    const settings = this.assetStorageSettingsStore.getSettings();
    if (settings.activeProvider !== 'local') {
      throw ApiServiceError.conflict(
        'Server upload cannot be used while a Storage/CDN provider is active. Upload the asset to CDN or import it by URL.',
      );
    }

    const record = await createAssetRecordFromUpload({
      ...input,
      createdByAdminUserId: access.adminUserId,
    });

    return toAssetDto(this.repository.create(record));
  }

  async cloudUpload(input: Omit<AssetUploadInput, 'createdByAdminUserId'>, authorization?: string): Promise<AssetDto> {
    const access = await this.adminAccessService.requireStoryEditorAccess(authorization);
    const settings = this.assetStorageSettingsStore.getSettings();
    const target =
      settings.activeProvider === 'supabase_s3'
        ? createSupabaseS3AssetUploadTarget(
            settings,
            this.assetStorageSettingsStore.getCurrentSupabaseS3SecretAccessKey(),
          )
        : createGcsAssetUploadTarget(settings);
    const record = await createAssetRecordFromCloudUpload(
      {
        ...input,
        createdByAdminUserId: access.adminUserId,
      },
      target,
    );

    return toAssetDto(this.repository.create(record));
  }

  async importFromUrl(input: CreateAssetFromUrlDto, authorization?: string): Promise<AssetDto> {
    const access = await this.adminAccessService.requireStoryEditorAccess(authorization);

    const record = await createAssetRecordFromUrlImport({
      ...input,
      createdByAdminUserId: access.adminUserId,
    });

    return toAssetDto(this.repository.create(record));
  }

  async delete(assetId: string, authorization?: string): Promise<void> {
    await this.adminAccessService.requireStoryEditorAccess(authorization);

    const asset = this.repository.findById(assetId);
    if (!asset) {
      throw ApiServiceError.notFound('Asset was not found.');
    }

    const usageReferences = this.repository.listCurrentUsage(assetId);
    if (usageReferences.length > 0) {
      throw ApiServiceError.conflict(
        'This asset cannot be deleted because it is used in current draft or published content.',
        { usageReferences },
      );
    }

    deleteAssetBinary(asset);
    const settings = this.assetStorageSettingsStore.getSettings();
    if (settings.activeProvider === 'supabase_s3') {
      await deleteSupabaseS3AssetBinary(
        asset,
        settings,
        this.assetStorageSettingsStore.getCurrentSupabaseS3SecretAccessKey(),
      );
    } else {
      await deleteGcsAssetBinary(asset, settings);
    }
    this.repository.deleteById(assetId);
  }
}

function toAssetDto(record: AssetRecord, usageReferences: AssetDto['usageReferences'] = []): AssetDto {
  return {
    id: record.id,
    type: toAssetDtoType(record.kind),
    url: record.publicUrl,
    name: record.sourceFileName ?? record.storageKey,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
    durationMs: record.durationMs,
    sizeBytes: record.sizeBytes,
    source: record.source,
    usageCount: usageReferences.length,
    usageReferences,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toAssetDtoType(kind: AssetRecord['kind']): AssetDto['type'] {
  if (kind === 'story_video_poster') {
    return 'story_poster';
  }

  if (kind === 'group_badge_svg') {
    return 'group_logo';
  }

  return kind;
}
