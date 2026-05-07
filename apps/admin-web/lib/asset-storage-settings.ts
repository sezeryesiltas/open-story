export const ASSET_UPLOAD_CAPABILITIES_QUERY_KEY = ['asset-upload-capabilities'] as const;

export type AssetUploadCapabilitiesDto = {
  serverUploadAllowed: boolean;
};

export function canUseServerAssetUpload(capabilities: AssetUploadCapabilitiesDto | null | undefined): boolean {
  return capabilities?.serverUploadAllowed === true;
}
