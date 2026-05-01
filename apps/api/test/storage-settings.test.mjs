import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AssetStorageSettingsStore } from '../src/modules/settings/asset-storage-settings.store.ts';

test('asset storage settings support Supabase S3 provider and preserve configured secret', () => {
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
