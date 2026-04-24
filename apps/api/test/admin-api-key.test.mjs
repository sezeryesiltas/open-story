import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DbService } from '@open-story/db';

import { AdminAccessService } from '../src/admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../src/admin-auth/simple-jwt.ts';
import { ApiServiceError } from '../src/common/filters/api-error.ts';
import { AdminApiKeyService } from '../src/modules/admin-api-key/admin-api-key.service.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { ClientService } from '../src/modules/client/client.service.ts';
import { StoryGroupService } from '../src/modules/story-group/story-group.service.ts';
import { StoryService } from '../src/modules/story/story.service.ts';
import { PublishResolutionRepository } from '../src/publish/publish-resolution.repository.ts';
import { PublishResolutionService } from '../src/publish/publish-resolution.service.ts';
import { StoryContentRepository } from '../src/story-content/story-content.repository.ts';
import { StoryPlatformRepository } from '../src/story-platform/story-platform.repository.ts';

const ASSET_LOGO_ID = '00000000-0000-4000-8000-000000000101';
const ASSET_STORY_ID = '00000000-0000-4000-8000-000000000102';

function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-api-admin-key-'));

  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');

  const db = new DbService();
  const platformRepository = new StoryPlatformRepository(db, {
    clientId: 'public-client-id',
    clientName: 'Open Story App',
    adminEmail: 'admin@openstory.local',
    adminPassword: 'admin12345',
  });
  const jwtService = new SimpleJwtService('test-admin-jwt-secret');
  const adminAccessService = new AdminAccessService(platformRepository, jwtService);
  const contentRepository = new StoryContentRepository(db);
  const publishRepository = new PublishResolutionRepository(db);
  const publishResolutionService = new PublishResolutionService(publishRepository);

  return {
    db,
    authService: new AuthService(platformRepository, jwtService, adminAccessService),
    adminApiKeyService: new AdminApiKeyService(platformRepository, adminAccessService),
    clientService: new ClientService(platformRepository, adminAccessService),
    groupService: new StoryGroupService(contentRepository, publishResolutionService, adminAccessService),
    storyService: new StoryService(contentRepository, publishResolutionService, adminAccessService),
  };
}

test('admin API keys can authenticate backend-to-backend admin content requests', async () => {
  const { db, authService, adminApiKeyService, clientService, groupService, storyService } = createHarness();
  seedAsset(db, { id: ASSET_LOGO_ID, kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo.png' });
  seedAsset(db, { id: ASSET_STORY_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story.png' });

  const sessionAuthorization = await loginAsAdmin(authService);
  const createdKey = await adminApiKeyService.create(
    { clientName: 'Content service production' },
    sessionAuthorization,
  );
  const apiKeyAuthorization = `Bearer ${createdKey.plainTextApiKey}`;

  assert.match(createdKey.plainTextApiKey, /^osak_/);
  assert.match(createdKey.clientSecret, /^oscs_/);
  assert.equal(createdKey.apiKey.clientName, 'Content service production');

  const client = await clientService.get(apiKeyAuthorization);
  assert.equal(client.clientId, 'public-client-id');

  const group = await groupService.create(
    {
      name: 'API Group',
      bottom_label: null,
      logo_asset_id: ASSET_LOGO_ID,
      badge: null,
      story_ids: [],
    },
    apiKeyAuthorization,
  );
  const story = await storyService.create(
    {
      group_id: group.id,
      name: 'API Story',
      media_type: 'image',
      asset_id: ASSET_STORY_ID,
      cta: null,
    },
    apiKeyAuthorization,
  );

  assert.equal(story.group_id, group.id);

  const listedKeys = await adminApiKeyService.list(sessionAuthorization);
  assert.equal(listedKeys.length, 1);
  assert.equal(Boolean(listedKeys[0].lastUsedAt), true);
});

test('revoked admin API keys stop authenticating admin APIs', async () => {
  const { authService, adminApiKeyService, clientService } = createHarness();
  const sessionAuthorization = await loginAsAdmin(authService);
  const createdKey = await adminApiKeyService.create({ clientName: 'Worker' }, sessionAuthorization);
  const apiKeyAuthorization = `Bearer ${createdKey.plainTextApiKey}`;

  await clientService.get(apiKeyAuthorization);
  await adminApiKeyService.revoke(createdKey.apiKey.id, {}, sessionAuthorization);

  await assert.rejects(
    () => clientService.get(apiKeyAuthorization),
    (error) => error instanceof ApiServiceError && error.statusCode === 403,
  );
});

test('admin API keys cannot mint additional admin API keys', async () => {
  const { authService, adminApiKeyService } = createHarness();
  const sessionAuthorization = await loginAsAdmin(authService);
  const createdKey = await adminApiKeyService.create({ clientName: 'Worker' }, sessionAuthorization);

  await assert.rejects(
    () => adminApiKeyService.create({ clientName: 'Nested Worker' }, `Bearer ${createdKey.plainTextApiKey}`),
    (error) => error instanceof ApiServiceError && error.statusCode === 401,
  );
});

async function loginAsAdmin(authService) {
  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });

  return `Bearer ${loginResponse.accessToken}`;
}

function seedAsset(db, asset) {
  const now = new Date().toISOString();
  db.insert('assets', {
    id: asset.id ?? randomUUID(),
    kind: asset.kind,
    source: 'url',
    mediaType: asset.mediaType,
    storageKey: asset.publicUrl,
    publicUrl: asset.publicUrl,
    sourceFileName: null,
    mimeType: asset.mediaType === 'video' ? 'video/mp4' : 'image/png',
    sizeBytes: 1024,
    width: 1080,
    height: asset.kind === 'group_logo' ? 1080 : 1920,
    durationMs: asset.mediaType === 'video' ? 10000 : null,
    checksumSha256: `checksum-${asset.id}`,
    createdByAdminUserId: null,
    createdAt: now,
    updatedAt: now,
  });
}
