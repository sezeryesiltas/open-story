import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DbService } from '@open-story/db';
import sharp from 'sharp';

import { AdminAccessService } from '../src/admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../src/admin-auth/simple-jwt.ts';
import { createAssetRecordFromCloudUpload } from '../src/modules/assets/asset-upload.ts';
import { AssetsRepository } from '../src/modules/assets/assets.repository.ts';
import { AssetsService } from '../src/modules/assets/assets.service.ts';
import { AssetStorageSettingsStore } from '../src/modules/settings/asset-storage-settings.store.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { StoryGroupService } from '../src/modules/story-group/story-group.service.ts';
import { PublishResolutionRepository } from '../src/publish/publish-resolution.repository.ts';
import { PublishResolutionService } from '../src/publish/publish-resolution.service.ts';
import { StoryContentRepository } from '../src/story-content/story-content.repository.ts';
import { ApiServiceError } from '../src/common/filters/api-error.ts';
import { StoryPlatformRepository } from '../src/story-platform/story-platform.repository.ts';

function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-api-assets-'));

  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');
  process.env.OPEN_STORY_ASSET_STORAGE_CONFIG_PATH = join(tempDir, 'asset-storage-config.json');
  process.env.OPEN_STORY_ASSET_STORAGE_DIR = join(tempDir, 'asset-storage');
  process.env.OPEN_STORY_PUBLIC_ASSET_BASE_URL = 'http://localhost:3001/uploads/assets';

  const db = new DbService();
  const repository = new StoryPlatformRepository(db, {
    clientId: 'public-client-id',
    clientName: 'Open Story App',
    adminEmail: 'admin@openstory.local',
    adminPassword: 'admin12345',
  });
  const jwtService = new SimpleJwtService('test-admin-jwt-secret');
  const adminAccessService = new AdminAccessService(repository, jwtService);
  const contentRepository = new StoryContentRepository(db);
  const publishResolutionService = new PublishResolutionService(new PublishResolutionRepository(db));
  const assetStorageSettingsStore = new AssetStorageSettingsStore();

  return {
    authService: new AuthService(repository, jwtService, adminAccessService),
    assetStorageSettingsStore,
    assetsService: new AssetsService(new AssetsRepository(db), adminAccessService, assetStorageSettingsStore),
    groupService: new StoryGroupService(contentRepository, publishResolutionService, adminAccessService),
  };
}

test('asset upload stores square logos and story media with extracted metadata', async () => {
  const { authService, assetsService } = createHarness();
  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;

  const logoAsset = await assetsService.upload(
    {
      type: 'group_logo',
      fileName: 'logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"></svg>'),
    },
    authorization,
  );

  assert.equal(logoAsset.type, 'group_logo');
  assert.equal(logoAsset.width, 128);
  assert.equal(logoAsset.height, 128);
  assert.equal(logoAsset.source, 'upload');

  const imageAsset = await assetsService.upload(
    {
      type: 'story_image',
      fileName: 'story.png',
      mimeType: 'image/png',
      buffer: await createPngBuffer(1200, 900),
    },
    authorization,
  );

  assert.equal(imageAsset.type, 'story_image');
  assert.equal(imageAsset.width, 1200);
  assert.equal(imageAsset.height, 900);
  assert.equal(imageAsset.durationMs, null);

  const posterAsset = await assetsService.upload(
    {
      type: 'story_poster',
      fileName: 'poster.png',
      mimeType: 'image/png',
      buffer: await createPngBuffer(640, 480),
    },
    authorization,
  );

  assert.equal(posterAsset.type, 'story_poster');
  assert.equal(posterAsset.width, 640);
  assert.equal(posterAsset.height, 480);

  const videoAsset = await assetsService.upload(
    {
      type: 'story_video',
      fileName: 'story.mp4',
      mimeType: 'video/mp4',
      buffer: createMp4Buffer({ width: 1920, height: 1080, durationMs: 15_000 }),
    },
    authorization,
  );

  assert.equal(videoAsset.type, 'story_video');
  assert.equal(videoAsset.durationMs, 15_000);
  assert.equal(videoAsset.width, 1920);
  assert.equal(videoAsset.height, 1080);

  const listedAssets = await assetsService.list({}, authorization);
  assert.equal(listedAssets.length, 4);
});

test('asset list exposes current usage and only unused assets can be deleted', async () => {
  const { authService, assetsService, groupService } = createHarness();
  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;

  const logoAsset = await assetsService.upload(
    {
      type: 'group_logo',
      fileName: 'logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"></svg>'),
    },
    authorization,
  );
  const unusedAsset = await assetsService.upload(
    {
      type: 'story_image',
      fileName: 'unused.png',
      mimeType: 'image/png',
      buffer: await createPngBuffer(1080, 1920),
    },
    authorization,
  );

  await groupService.create(
    {
      name: 'Used Logo Group',
      bottom_label: null,
      logo_asset_id: logoAsset.id,
      badge: null,
      story_ids: [],
    },
    authorization,
  );

  const listedAssets = await assetsService.list({}, authorization);
  const listedLogo = listedAssets.find((asset) => asset.id === logoAsset.id);
  const listedUnusedAsset = listedAssets.find((asset) => asset.id === unusedAsset.id);

  assert.equal(listedLogo?.usageCount, 1);
  assert.equal(listedLogo?.usageReferences[0]?.entityType, 'story_group');
  assert.equal(listedUnusedAsset?.usageCount, 0);

  await assert.rejects(
    () => assetsService.delete(logoAsset.id, authorization),
    (error) => error instanceof ApiServiceError && error.statusCode === 409,
  );

  await assetsService.delete(unusedAsset.id, authorization);

  const listedAfterDelete = await assetsService.list({}, authorization);
  assert.equal(listedAfterDelete.some((asset) => asset.id === unusedAsset.id), false);
});

test('asset upload rejects non-square logos and overlong videos', async () => {
  const { authService, assetsService } = createHarness();
  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;
  const nonSquareLogoBuffer = await createPngBuffer(128, 256);

  await assert.rejects(
    () =>
      assetsService.upload(
        {
          type: 'group_logo',
          fileName: 'logo.png',
          mimeType: 'image/png',
          buffer: nonSquareLogoBuffer,
        },
        authorization,
      ),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 400 &&
      error.message.includes('square'),
  );

  await assert.rejects(
    () =>
      assetsService.upload(
        {
          type: 'story_video',
          fileName: 'story.mp4',
          mimeType: 'video/mp4',
          buffer: createMp4Buffer({ width: 1080, height: 1920, durationMs: 31_000 }),
        },
        authorization,
      ),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 400 &&
      error.message.includes('30 seconds'),
  );
});

test('asset URL import validates remote image and preserves url source', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(await createPngBuffer(1200, 900), {
      status: 200,
      headers: {
        'content-type': 'image/png',
      },
    });

  try {
    const { authService, assetsService } = createHarness();
    const loginResponse = await authService.login({
      email: 'admin@openstory.local',
      password: 'admin12345',
    });
    const authorization = `Bearer ${loginResponse.accessToken}`;

    const importedAsset = await assetsService.importFromUrl(
      {
        type: 'story_image',
        url: 'https://cdn.example.com/story.png',
      },
      authorization,
    );

    assert.equal(importedAsset.type, 'story_image');
    assert.equal(importedAsset.url, 'https://cdn.example.com/story.png');
    assert.equal(importedAsset.source, 'url');
    assert.equal(importedAsset.width, 1200);
    assert.equal(importedAsset.height, 900);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('server upload optimizes PNG images before storing asset records', async () => {
  const { authService, assetsService } = createHarness();
  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;

  const logoAsset = await assetsService.upload(
    {
      type: 'group_logo',
      fileName: 'logo.png',
      mimeType: 'image/png',
      buffer: await createPngBuffer(900, 900),
    },
    authorization,
  );

  assert.equal(logoAsset.mimeType, 'image/jpeg');
  assert.equal(logoAsset.width, 500);
  assert.equal(logoAsset.height, 500);
  assert.equal(logoAsset.name.endsWith('.jpg'), true);

  const storyAsset = await assetsService.upload(
    {
      type: 'story_image',
      fileName: 'story.png',
      mimeType: 'image/png',
      buffer: await createPngBuffer(1200, 2400),
    },
    authorization,
  );

  assert.equal(storyAsset.mimeType, 'image/jpeg');
  assert.equal(storyAsset.height, 1600);
  assert.equal(storyAsset.width, 800);
});

test('server upload is blocked when external asset storage is active', async () => {
  const { authService, assetsService, assetStorageSettingsStore } = createHarness();
  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;

  assetStorageSettingsStore.updateSettings({
    activeProvider: 'supabase_s3',
    supabaseS3: {
      endpoint: 'https://project-ref.storage.supabase.co/storage/v1/s3',
      region: 'project_region',
      bucketName: 'open-story-assets',
      accessKeyId: 'access-key-id',
      secretAccessKey: 'secret-access-key',
      publicAssetBaseUrl: 'https://project-ref.supabase.co/storage/v1/object/public/open-story-assets',
    },
  });
  const imageBuffer = await createPngBuffer(1200, 2400);

  await assert.rejects(
    () =>
      assetsService.upload(
        {
          type: 'story_image',
          fileName: 'story.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        authorization,
      ),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 409 &&
      error.message.includes('Server upload cannot be used while a Storage/CDN provider is active'),
  );
});

test('cloud upload prepares optimized asset records and delegates binary storage', async () => {
  const writes = [];

  const record = await createAssetRecordFromCloudUpload(
    {
      type: 'story_image',
      fileName: 'cloud-story.png',
      mimeType: 'image/png',
      buffer: await createPngBuffer(1200, 2400),
      createdByAdminUserId: null,
    },
    {
      storageKeyPrefix: 'assets',
      publicAssetBaseUrl: 'https://assets.example.com',
      write: async (write) => {
        writes.push(write);
      },
    },
  );

  assert.equal(record.source, 'cloud_upload');
  assert.equal(record.mimeType, 'image/jpeg');
  assert.equal(record.width, 800);
  assert.equal(record.height, 1600);
  assert.equal(record.publicUrl.startsWith('https://assets.example.com/assets/story_image/'), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].mimeType, 'image/jpeg');
});

async function createPngBuffer(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function createMp4Buffer({ width, height, durationMs }) {
  const ftyp = atom(
    'ftyp',
    Buffer.from('isom'),
    uint32(0),
    Buffer.from('isom'),
    Buffer.from('mp41'),
  );

  const mvhdBody = Buffer.alloc(100);
  mvhdBody.writeUInt32BE(0, 0);
  mvhdBody.writeUInt32BE(1000, 12);
  mvhdBody.writeUInt32BE(durationMs, 16);

  const tkhdBody = Buffer.alloc(84);
  tkhdBody.writeUInt32BE(7, 0);
  tkhdBody.writeUInt32BE(1, 12);
  tkhdBody.writeUInt32BE(durationMs, 20);
  tkhdBody.writeUInt32BE(width * 65536, 76);
  tkhdBody.writeUInt32BE(height * 65536, 80);

  const hdlrBody = Buffer.alloc(24);
  Buffer.from('vide').copy(hdlrBody, 8);

  const moov = atom(
    'moov',
    atom('mvhd', mvhdBody),
    atom('trak', atom('tkhd', tkhdBody), atom('mdia', atom('hdlr', hdlrBody))),
  );

  return Buffer.concat([ftyp, moov]);
}

function atom(type, ...payloads) {
  const payload = Buffer.concat(payloads);
  return Buffer.concat([uint32(payload.length + 8), Buffer.from(type), payload]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value, 0);
  return buffer;
}
