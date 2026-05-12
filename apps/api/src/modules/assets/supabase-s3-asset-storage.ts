import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AssetRecord, AssetStorageSettingsDto } from '@open-story/contracts';

import { ApiServiceError } from '../../common/filters/api-error.ts';
import type { CloudAssetUploadTarget } from './asset-upload.ts';

function createSupabaseS3Client(settings: AssetStorageSettingsDto, secretAccessKey: string): S3Client {
  const endpoint = settings.supabaseS3.endpoint?.trim();
  const accessKeyId = settings.supabaseS3.accessKeyId?.trim();

  if (!endpoint || !accessKeyId || !secretAccessKey.trim()) {
    throw ApiServiceError.badRequest(
      'Endpoint, access key ID, and secret access key settings are required for Supabase S3 upload.',
    );
  }

  return new S3Client({
    endpoint,
    region: settings.supabaseS3.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function createSupabaseS3AssetUploadTarget(
  settings: AssetStorageSettingsDto,
  secretAccessKey: string | null,
): CloudAssetUploadTarget {
  if (settings.activeProvider !== 'supabase_s3') {
    throw ApiServiceError.badRequest('Supabase S3 provider must be active for cloud upload.');
  }

  const bucketName = settings.supabaseS3.bucketName?.trim();
  const publicAssetBaseUrl = settings.supabaseS3.publicAssetBaseUrl?.trim();
  if (!bucketName || !publicAssetBaseUrl) {
    throw ApiServiceError.badRequest('Bucket and CDN public base URL settings are required for cloud upload.');
  }

  const client = createSupabaseS3Client(settings, secretAccessKey ?? '');

  return {
    storageKeyPrefix: settings.supabaseS3.objectPrefix,
    publicAssetBaseUrl,
    write: async ({ storageKey, buffer, mimeType }) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: settings.supabaseS3.cacheControl,
        }),
      );
    },
  };
}

export async function deleteSupabaseS3AssetBinary(
  record: AssetRecord,
  settings: AssetStorageSettingsDto,
  secretAccessKey: string | null,
): Promise<void> {
  if (record.source !== 'cloud_upload') {
    return;
  }

  const bucketName = settings.supabaseS3.bucketName?.trim();
  if (!bucketName) {
    throw ApiServiceError.badRequest('Supabase bucket setting is required to delete a cloud asset.');
  }

  const client = createSupabaseS3Client(settings, secretAccessKey ?? '');
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: record.storageKey,
    }),
  );
}
