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
    await this.adminAccessService.requireAdminAccess(authorization);

    return this.repository
      .list()
      .map((record) => toAssetDto(record, this.repository.listCurrentUsage(record.id)))
      .filter((asset) => (query.type ? asset.type === query.type : true));
  }

  async upload(input: Omit<AssetUploadInput, 'createdByAdminUserId'>, authorization?: string): Promise<AssetDto> {
    const access = await this.adminAccessService.requireAdminAccess(authorization);

    const record = await createAssetRecordFromUpload({
      ...input,
      createdByAdminUserId: access.adminUserId,
    });

    return toAssetDto(this.repository.create(record));
  }

  async cloudUpload(input: Omit<AssetUploadInput, 'createdByAdminUserId'>, authorization?: string): Promise<AssetDto> {
    const access = await this.adminAccessService.requireAdminAccess(authorization);
    const settings = this.assetStorageSettingsStore.getSettings();
    const target = createGcsAssetUploadTarget(settings);
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
    const access = await this.adminAccessService.requireAdminAccess(authorization);

    const record = await createAssetRecordFromUrlImport({
      ...input,
      createdByAdminUserId: access.adminUserId,
    });

    return toAssetDto(this.repository.create(record));
  }

  async delete(assetId: string, authorization?: string): Promise<void> {
    await this.adminAccessService.requireAdminAccess(authorization);

    const asset = this.repository.findById(assetId);
    if (!asset) {
      throw ApiServiceError.notFound('Asset bulunamadı.');
    }

    const usageReferences = this.repository.listCurrentUsage(assetId);
    if (usageReferences.length > 0) {
      throw ApiServiceError.conflict(
        'Bu asset current draft veya published içerikte kullanıldığı için silinemez.',
        { usageReferences },
      );
    }

    deleteAssetBinary(asset);
    await deleteGcsAssetBinary(asset, this.assetStorageSettingsStore.getSettings());
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
