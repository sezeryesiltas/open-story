export type Platform = 'ios' | 'android';

export interface AuthLoginRequestDto {
  email: string;
  password: string;
}

export interface AuthLoginResponseDto {
  accessToken: string;
  expiresIn: number;
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

export interface CreateStaticTokenDto {
  label: string;
}

export interface StaticTokenDto {
  id: string;
  label: string;
  tokenPreview: string;
  isActive: boolean;
}

export interface RevokeStaticTokenDto {
  tokenId: string;
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

export interface CreateAssetDto {
  type: 'group_logo' | 'story_image' | 'story_video' | 'story_poster';
  mimeType: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface AssetDto {
  id: string;
  type: string;
  url: string;
}

export interface SdkFeedRequestDto {
  client_id: string;
  placement_key: string;
  platform: Platform;
  app_version: string;
  user_segments: string[];
}

export interface SdkStoryItemDto {
  story_id: string;
  story_revision_id: string;
  media_type: 'image' | 'video';
  media_url: string;
  poster_url?: string;
  image_duration_ms?: number;
  cta?: {
    label: string;
    type: 'url' | 'deeplink';
    value: string;
  };
}

export interface SdkStoryGroupItemDto {
  group_id: string;
  group_revision_id: string;
  title: string;
  logo_url: string;
  stories: SdkStoryItemDto[];
}

export interface SdkFeedResponseDto {
  placement_key: string;
  set_id?: string;
  set_revision_id?: string;
  groups: SdkStoryGroupItemDto[];
}
