import type { AssetDto, CreateAssetFromUrlDto, ListAssetsQueryDto } from '@open-story/contracts';

import { AdminAccessService } from '../../admin-auth/admin-access.service.ts';
import { AssetsRepository } from './assets.repository.ts';
import {
  createAssetRecordFromUpload,
  createAssetRecordFromUrlImport,
  type AssetUploadInput,
} from './asset-upload.ts';

export class AssetsService {
  private readonly repository: AssetsRepository;
  private readonly adminAccessService: AdminAccessService;

  constructor(
    repository: AssetsRepository,
    adminAccessService: AdminAccessService,
  ) {
    this.repository = repository;
    this.adminAccessService = adminAccessService;
  }

  async list(query: ListAssetsQueryDto, authorization?: string): Promise<AssetDto[]> {
    await this.adminAccessService.requireAdminAccess(authorization);

    return this.repository
      .list()
      .map((record) => toAssetDto(record))
      .filter((asset) => (query.type ? asset.type === query.type : true));
  }

  async upload(input: Omit<AssetUploadInput, 'createdByAdminUserId'>, authorization?: string): Promise<AssetDto> {
    const { user } = await this.adminAccessService.requireAdminAccess(authorization);

    const record = createAssetRecordFromUpload({
      ...input,
      createdByAdminUserId: user.id,
    });

    return toAssetDto(this.repository.create(record));
  }

  async importFromUrl(input: CreateAssetFromUrlDto, authorization?: string): Promise<AssetDto> {
    const { user } = await this.adminAccessService.requireAdminAccess(authorization);

    const record = await createAssetRecordFromUrlImport({
      ...input,
      createdByAdminUserId: user.id,
    });

    return toAssetDto(this.repository.create(record));
  }
}

function toAssetDto(record: import('@open-story/contracts').AssetRecord): AssetDto {
  return {
    id: record.id,
    type: record.kind === 'story_video_poster' ? 'story_poster' : record.kind,
    url: record.publicUrl,
    name: record.sourceFileName ?? record.storageKey,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
    durationMs: record.durationMs,
    sizeBytes: record.sizeBytes,
    source: record.source,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
