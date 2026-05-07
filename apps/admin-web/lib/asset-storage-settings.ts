import type { AssetStorageSettingsDto } from '@open-story/contracts';

export const ASSET_STORAGE_SETTINGS_QUERY_KEY = ['asset-storage-settings'] as const;

export function canUseServerAssetUpload(settings: AssetStorageSettingsDto | null | undefined): boolean {
  return settings?.activeProvider === 'local';
}
