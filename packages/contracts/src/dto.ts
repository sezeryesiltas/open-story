import type {
  SdkFeedGroup,
  SdkFeedRequest,
  SdkFeedResponse,
  SdkFeedStory,
} from './sdk/feed.ts';
import type {
  ArchiveStoryDto as AdminArchiveStoryDto,
  CreateStoryDto as AdminCreateStoryDto,
  PublishStoryDto as AdminPublishStoryDto,
  Story as AdminStory,
  UpdateStoryDto as AdminUpdateStoryDto,
} from './admin/story.ts';
import type {
  ArchiveStoryGroupDto as AdminArchiveStoryGroupDto,
  CreateStoryGroupDto as AdminCreateStoryGroupDto,
  PublishStoryGroupDto as AdminPublishStoryGroupDto,
  StoryGroup as AdminStoryGroup,
  UpdateStoryGroupDto as AdminUpdateStoryGroupDto,
} from './admin/group.ts';
import type {
  CreateStoryGroupSetDto as AdminCreateStoryGroupSetDto,
  PublishStoryGroupSetDto as AdminPublishStoryGroupSetDto,
  StoryGroupSet as AdminStoryGroupSet,
  UpdateStoryGroupSetDto as AdminUpdateStoryGroupSetDto,
} from './admin/set.ts';

export type Platform = 'ios' | 'android';

export interface AuthLoginRequestDto {
  email: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  mustChangePassword: boolean;
  isActive: boolean;
}

export interface AuthSessionDto {
  id: string;
  expiresAt: string;
}

export interface AuthLoginResponseDto {
  accessToken: string;
  expiresIn: number;
  user: AuthUserDto;
  session: AuthSessionDto;
}

export interface AuthSessionResponseDto {
  user: AuthUserDto;
  session: AuthSessionDto;
}

export interface AuthChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface AdminUserDto {
  id: string;
  email: string;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminUserDto {
  email: string;
  temporaryPassword: string;
}

export interface ResetAdminUserPasswordDto {
  temporaryPassword: string;
}

export interface DatabaseSettingsDto {
  defaultSqliteUrl: string;
  activeDatabaseUrl: string;
  externalDatabaseUrl: string | null;
  isUsingExternalDatabase: boolean;
  migratedAt: string | null;
  tableCounts: Record<string, number>;
}

export interface UpdateDatabaseSettingsDto {
  externalDatabaseUrl?: string | null;
}

export interface ClientDto {
  id: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateClientDto {
  name?: string;
  isActive?: boolean;
}

export interface CreateStaticTokenDto {
  label: string;
}

export interface StaticTokenDto {
  id: string;
  clientId: string;
  label: string;
  tokenPrefix: string;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateStaticTokenResponseDto {
  token: StaticTokenDto;
  plainTextToken: string;
}

export interface RevokeStaticTokenDto {
  reason?: string;
}

export interface AdminApiKeyDto {
  id: string;
  clientName: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface CreateAdminApiKeyDto {
  clientName: string;
}

export interface CreateAdminApiKeyResponseDto {
  apiKey: AdminApiKeyDto;
  plainTextApiKey: string;
  clientSecret: string;
}

export interface RevokeAdminApiKeyDto {
  reason?: string;
}

export interface CreatePlacementDto {
  key: string;
  name: string;
  description?: string;
}

export interface UpdatePlacementDto {
  key?: string;
  name?: string;
  description?: string;
}

export interface PlacementDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateStoryGroupSetDto = AdminCreateStoryGroupSetDto;
export type UpdateStoryGroupSetDto = AdminUpdateStoryGroupSetDto;
export type PublishStoryGroupSetDto = AdminPublishStoryGroupSetDto;
export type StoryGroupSetDto = AdminStoryGroupSet;

export type CreateStoryGroupDto = AdminCreateStoryGroupDto;
export type UpdateStoryGroupDto = AdminUpdateStoryGroupDto;
export type PublishStoryGroupDto = AdminPublishStoryGroupDto;
export type ArchiveStoryGroupDto = AdminArchiveStoryGroupDto;
export type StoryGroupDto = AdminStoryGroup;

export type CreateStoryDto = AdminCreateStoryDto;
export type UpdateStoryDto = AdminUpdateStoryDto;
export type PublishStoryDto = AdminPublishStoryDto;
export type ArchiveStoryDto = AdminArchiveStoryDto;
export type StoryDto = AdminStory;

export type AssetTypeDto = 'group_logo' | 'story_image' | 'story_video' | 'story_poster';

export interface AssetUsageReferenceDto {
  entityType: 'story_group' | 'story';
  entityId: string;
  revisionId: string;
  revisionStatus: 'draft' | 'published';
  field: 'logo' | 'media' | 'poster';
  name: string;
}

export interface AssetDto {
  id: string;
  type: AssetTypeDto;
  url: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  source: 'upload' | 'url';
  usageCount: number;
  usageReferences: AssetUsageReferenceDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ListAssetsQueryDto {
  type?: AssetTypeDto;
}

export interface CreateAssetFromUrlDto {
  type: AssetTypeDto;
  url: string;
}

export type SdkFeedRequestDto = SdkFeedRequest;
export type SdkStoryItemDto = SdkFeedStory;
export type SdkStoryGroupItemDto = SdkFeedGroup;
export type SdkFeedResponseDto = SdkFeedResponse;
