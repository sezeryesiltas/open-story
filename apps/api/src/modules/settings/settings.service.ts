import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  AssetStorageSettingsDto,
  DatabaseSettingsDto,
  TestAssetStorageConnectionResponseDto,
  TestAssetStorageSettingsDto,
  TestDatabaseConnectionDto,
  TestDatabaseConnectionResponseDto,
  UpdateAssetStorageSettingsDto,
  UpdateDatabaseSettingsDto,
} from '@open-story/contracts';
import { DbService } from '@open-story/db';
import { Storage } from '@google-cloud/storage';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { AssetStorageSettingsStore } from './asset-storage-settings.store.ts';

@Injectable()
export class SettingsService {
  private readonly db: DbService;
  private readonly assetStorageSettingsStore: AssetStorageSettingsStore;

  constructor(
    @Inject(DbService) db: DbService,
    assetStorageSettingsStore: AssetStorageSettingsStore,
  ) {
    this.db = db;
    this.assetStorageSettingsStore = assetStorageSettingsStore;
  }

  getDatabaseSettings(): DatabaseSettingsDto {
    return this.db.getDatabaseSettings();
  }

  updateDatabaseSettings(payload: UpdateDatabaseSettingsDto): DatabaseSettingsDto {
    try {
      return this.db.updateDatabaseSettings(payload);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Database ayarları güncellenemedi.',
      );
    }
  }

  testDatabaseConnection(payload: TestDatabaseConnectionDto): TestDatabaseConnectionResponseDto {
    try {
      return this.db.testDatabaseConnection(payload);
    } catch (error) {
      return {
        ok: false,
        provider: null,
        message: error instanceof Error ? error.message : 'Database bağlantısı test edilemedi.',
        resolvedDatabaseUrl: null,
      };
    }
  }

  getAssetStorageSettings(): AssetStorageSettingsDto {
    return this.assetStorageSettingsStore.getSettings();
  }

  updateAssetStorageSettings(payload: UpdateAssetStorageSettingsDto): AssetStorageSettingsDto {
    try {
      return this.assetStorageSettingsStore.updateSettings(payload);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Storage ayarları güncellenemedi.',
      );
    }
  }

  async testAssetStorageConnection(
    payload: TestAssetStorageSettingsDto,
  ): Promise<TestAssetStorageConnectionResponseDto> {
    try {
      const { settings, supabaseS3SecretAccessKey } =
        this.assetStorageSettingsStore.normalizeCandidateForConnection(payload);

      if (settings.activeProvider === 'local') {
        return {
          ok: true,
          provider: 'local',
          message: 'Local asset storage ayarı geçerli.',
          bucketName: null,
          publicAssetBaseUrl: settings.localPublicAssetBaseUrl,
        };
      }

      if (settings.activeProvider === 'supabase_s3') {
        const bucketName = settings.supabaseS3.bucketName;
        if (!bucketName) {
          throw new Error('Supabase bucket adı boş bırakılamaz.');
        }

        const endpoint = settings.supabaseS3.endpoint;
        const accessKeyId = settings.supabaseS3.accessKeyId;
        const secretAccessKey = supabaseS3SecretAccessKey;
        if (!endpoint || !accessKeyId || !secretAccessKey) {
          throw new Error('Supabase S3 endpoint, access key ID ve secret access key zorunludur.');
        }

        const client = new S3Client({
          endpoint,
          region: settings.supabaseS3.region,
          forcePathStyle: true,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));

        return {
          ok: true,
          provider: 'supabase_s3',
          message: 'Supabase bucket erişimi doğrulandı.',
          bucketName,
          publicAssetBaseUrl: settings.supabaseS3.publicAssetBaseUrl,
        };
      }

      const bucketName = settings.gcs.bucketName;
      if (!bucketName) {
        throw new Error('Google Cloud bucket adı boş bırakılamaz.');
      }

      const storage = new Storage(settings.gcs.projectId ? { projectId: settings.gcs.projectId } : undefined);
      const [exists] = await storage.bucket(bucketName).exists();
      if (!exists) {
        throw new Error(`Google Cloud bucket bulunamadı: ${bucketName}`);
      }

      return {
        ok: true,
        provider: 'gcs',
        message: 'Google Cloud bucket erişimi doğrulandı.',
        bucketName,
        publicAssetBaseUrl: settings.gcs.publicAssetBaseUrl,
      };
    } catch (error) {
      return {
        ok: false,
        provider: null,
        message: error instanceof Error ? error.message : 'Storage bağlantısı test edilemedi.',
        bucketName: null,
        publicAssetBaseUrl: null,
      };
    }
  }
}
