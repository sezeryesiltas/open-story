import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AssetStorageSettingsStore } from '../src/modules/settings/asset-storage-settings.store.ts';

const STORAGE_ENV_KEYS = [
  'OPEN_STORY_ASSET_STORAGE_CONFIG_PATH',
  'OPEN_STORY_PUBLIC_ASSET_BASE_URL',
  'OPEN_STORY_ASSET_STORAGE_PROVIDER',
  'OPEN_STORY_GCS_PROJECT_ID',
  'OPEN_STORY_GCS_BUCKET',
  'OPEN_STORY_GCS_OBJECT_PREFIX',
  'OPEN_STORY_GCS_PUBLIC_ASSET_BASE_URL',
  'OPEN_STORY_GCS_CACHE_CONTROL',
  'OPEN_STORY_SUPABASE_S3_ENDPOINT',
  'OPEN_STORY_SUPABASE_S3_REGION',
  'OPEN_STORY_SUPABASE_S3_BUCKET',
  'OPEN_STORY_SUPABASE_S3_ACCESS_KEY_ID',
  'OPEN_STORY_SUPABASE_S3_SECRET_ACCESS_KEY',
  'OPEN_STORY_SUPABASE_S3_OBJECT_PREFIX',
  'OPEN_STORY_SUPABASE_S3_PUBLIC_BASE_URL',
  'OPEN_STORY_SUPABASE_S3_CACHE_CONTROL',
];

function clearStorageEnv() {
  for (const key of STORAGE_ENV_KEYS) {
    delete process.env[key];
  }
}

test('asset storage settings support Supabase S3 provider and preserve configured secret', () => {
  clearStorageEnv();
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-storage-settings-'));
  process.env.OPEN_STORY_ASSET_STORAGE_CONFIG_PATH = join(tempDir, 'asset-storage-config.json');

  const store = new AssetStorageSettingsStore();

  const settings = store.updateSettings({
    activeProvider: 'supabase_s3',
    supabaseS3: {
      endpoint: 'https://project-ref.storage.supabase.co/storage/v1/s3',
      region: 'eu-central-1',
      bucketName: 'open-story-assets',
      accessKeyId: 'access-key-id',
      secretAccessKey: 'secret-access-key',
      objectPrefix: 'cdn-assets',
      publicAssetBaseUrl: 'https://project-ref.supabase.co/storage/v1/object/public/open-story-assets',
      cacheControl: 'public, max-age=60',
    },
  });

  assert.equal(settings.activeProvider, 'supabase_s3');
  assert.equal(settings.supabaseS3.forcePathStyle, true);
  assert.equal(settings.supabaseS3.secretAccessKeyConfigured, true);
  assert.equal(store.getCurrentSupabaseS3SecretAccessKey(), 'secret-access-key');

  const updatedSettings = store.updateSettings({
    activeProvider: 'supabase_s3',
    supabaseS3: {
      endpoint: 'https://project-ref.storage.supabase.co/storage/v1/s3',
      region: 'eu-central-1',
      bucketName: 'open-story-assets',
      accessKeyId: 'access-key-id',
      secretAccessKey: '',
      objectPrefix: 'assets',
      publicAssetBaseUrl: 'https://project-ref.supabase.co/storage/v1/object/public/open-story-assets',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  assert.equal(updatedSettings.supabaseS3.objectPrefix, 'assets');
  assert.equal(updatedSettings.supabaseS3.secretAccessKeyConfigured, true);
  assert.equal(store.getCurrentSupabaseS3SecretAccessKey(), 'secret-access-key');
});

test('asset storage settings resolve environment values before config file values', () => {
  clearStorageEnv();
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-storage-env-priority-'));
  process.env.OPEN_STORY_ASSET_STORAGE_CONFIG_PATH = join(tempDir, 'asset-storage-config.json');

  const store = new AssetStorageSettingsStore();
  store.updateSettings({
    activeProvider: 'supabase_s3',
    supabaseS3: {
      endpoint: 'https://config-ref.storage.supabase.co/storage/v1/s3',
      region: 'eu-central-1',
      bucketName: 'config-bucket',
      accessKeyId: 'config-access-key-id',
      secretAccessKey: 'config-secret-access-key',
      objectPrefix: 'config-assets',
      publicAssetBaseUrl: 'https://config-ref.supabase.co/storage/v1/object/public/config-bucket',
      cacheControl: 'public, max-age=60',
    },
  });

  process.env.OPEN_STORY_ASSET_STORAGE_PROVIDER = 'gcs';
  process.env.OPEN_STORY_GCS_PROJECT_ID = 'env-project';
  process.env.OPEN_STORY_GCS_BUCKET = 'env-bucket';
  process.env.OPEN_STORY_GCS_OBJECT_PREFIX = 'env-assets';
  process.env.OPEN_STORY_GCS_PUBLIC_ASSET_BASE_URL = 'https://assets.env.example.com';
  process.env.OPEN_STORY_GCS_CACHE_CONTROL = 'public, max-age=120';

  const settings = store.getSettings();

  assert.equal(settings.activeProvider, 'gcs');
  assert.equal(settings.gcs.projectId, 'env-project');
  assert.equal(settings.gcs.bucketName, 'env-bucket');
  assert.equal(settings.gcs.objectPrefix, 'env-assets');
  assert.equal(settings.gcs.publicAssetBaseUrl, 'https://assets.env.example.com');
  assert.equal(settings.gcs.cacheControl, 'public, max-age=120');
});

test('asset storage store exposes runtime Supabase secret from environment before config file', () => {
  clearStorageEnv();
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-storage-secret-priority-'));
  process.env.OPEN_STORY_ASSET_STORAGE_CONFIG_PATH = join(tempDir, 'asset-storage-config.json');

  const store = new AssetStorageSettingsStore();
  store.updateSettings({
    activeProvider: 'supabase_s3',
    supabaseS3: {
      endpoint: 'https://config-ref.storage.supabase.co/storage/v1/s3',
      region: 'eu-central-1',
      bucketName: 'config-bucket',
      accessKeyId: 'config-access-key-id',
      secretAccessKey: 'config-secret-access-key',
      objectPrefix: 'config-assets',
      publicAssetBaseUrl: 'https://config-ref.supabase.co/storage/v1/object/public/config-bucket',
      cacheControl: 'public, max-age=60',
    },
  });

  process.env.OPEN_STORY_ASSET_STORAGE_PROVIDER = 'supabase_s3';
  process.env.OPEN_STORY_SUPABASE_S3_SECRET_ACCESS_KEY = 'env-secret-access-key';

  assert.equal(store.getCurrentSupabaseS3SecretAccessKey(), 'env-secret-access-key');
});
