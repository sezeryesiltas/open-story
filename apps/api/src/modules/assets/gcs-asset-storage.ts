import { Storage } from '@google-cloud/storage';
import type { AssetRecord, AssetStorageSettingsDto } from '@open-story/contracts';

import { ApiServiceError } from '../../common/filters/api-error.ts';
import type { CloudAssetUploadTarget } from './asset-upload.ts';

export function createGcsAssetUploadTarget(settings: AssetStorageSettingsDto): CloudAssetUploadTarget {
  if (settings.activeProvider !== 'gcs') {
    throw ApiServiceError.badRequest('Cloud upload için Google Cloud Storage provider aktif olmalıdır.');
  }

  const bucketName = settings.gcs.bucketName?.trim();
  const publicAssetBaseUrl = settings.gcs.publicAssetBaseUrl?.trim();
  if (!bucketName || !publicAssetBaseUrl) {
    throw ApiServiceError.badRequest('Cloud upload için bucket ve CDN public base URL ayarları zorunludur.');
  }

  const storage = new Storage(settings.gcs.projectId ? { projectId: settings.gcs.projectId } : undefined);
  const bucket = storage.bucket(bucketName);

  return {
    storageKeyPrefix: settings.gcs.objectPrefix,
    publicAssetBaseUrl,
    write: async ({ storageKey, buffer, mimeType }) => {
      await bucket.file(storageKey).save(buffer, {
        contentType: mimeType,
        resumable: buffer.byteLength > 5 * 1024 * 1024,
        metadata: {
          cacheControl: settings.gcs.cacheControl,
        },
      });
    },
  };
}

export async function deleteGcsAssetBinary(
  record: AssetRecord,
  settings: AssetStorageSettingsDto,
): Promise<void> {
  if (record.source !== 'cloud_upload') {
    return;
  }

  const bucketName = settings.gcs.bucketName?.trim();
  if (!bucketName) {
    throw ApiServiceError.badRequest('Cloud asset silmek için Google Cloud bucket ayarı zorunludur.');
  }

  const storage = new Storage(settings.gcs.projectId ? { projectId: settings.gcs.projectId } : undefined);
  await storage.bucket(bucketName).file(record.storageKey).delete({ ignoreNotFound: true });
}
