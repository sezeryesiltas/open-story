import type {
  SdkFeedGroup,
  SdkFeedRequest,
  SdkFeedResponse,
  SdkFeedStory,
} from './sdk/feed.ts';

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

export interface CreateStoryGroupSetDto {
  placementId: string;
  name: string;
  isFallback: boolean;
  platforms: Array<{ platform: Platform; minAppVersion: string }>;
  segments: string[];
}

export interface StoryGroupSetDto {
  id: string;
  name: string;
  placementId: string;
  isFallback: boolean;
}

export interface CreateStoryGroupDto {
  title: string;
  logoAssetId: string;
  badgeType?: 'emoji' | 'svg';
  badgeValue?: string;
}

export interface StoryGroupDto {
  id: string;
  title: string;
  isArchived: boolean;
}

export interface CreateStoryDto {
  storyGroupId: string;
  mediaAssetId: string;
  mediaType: 'image' | 'video';
  posterAssetId?: string;
  imageDurationMs?: number;
  cta?: {
    label: string;
    type: 'url' | 'deeplink';
    value: string;
  };
}

export interface StoryDto {
  id: string;
  storyGroupId: string;
  mediaType: 'image' | 'video';
  isArchived: boolean;
}

export type AssetTypeDto = 'group_logo' | 'story_image' | 'story_video' | 'story_poster';

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
  source: 'upload';
  createdAt: string;
  updatedAt: string;
}

export interface ListAssetsQueryDto {
  type?: AssetTypeDto;
}

export type SdkFeedRequestDto = SdkFeedRequest;
export type SdkStoryItemDto = SdkFeedStory;
export type SdkStoryGroupItemDto = SdkFeedGroup;
export type SdkFeedResponseDto = SdkFeedResponse;
