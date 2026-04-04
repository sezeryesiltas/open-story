import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DbService } from '@open-story/db';

import { AdminAccessService } from '../src/admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../src/admin-auth/simple-jwt.ts';
import { ApiServiceError } from '../src/common/filters/api-error.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { ClientTokenService } from '../src/modules/client-token/client-token.service.ts';
import { SdkFeedRepository } from '../src/modules/sdk-feed/sdk-feed.repository.ts';
import { SdkFeedService } from '../src/modules/sdk-feed/sdk-feed.service.ts';
import { StoryGroupService } from '../src/modules/story-group/story-group.service.ts';
import { StoryGroupSetService } from '../src/modules/story-group-set/story-group-set.service.ts';
import { StoryService } from '../src/modules/story/story.service.ts';
import { PublishResolutionRepository } from '../src/publish/publish-resolution.repository.ts';
import { PublishResolutionService } from '../src/publish/publish-resolution.service.ts';
import { StaticTokenGuard } from '../src/sdk-auth/static-token.guard.ts';
import { StoryContentRepository } from '../src/story-content/story-content.repository.ts';
import { StoryPlatformRepository } from '../src/story-platform/story-platform.repository.ts';

const PLACEMENT_HOME_ID = '10000000-0000-4000-8000-000000000001';
const ASSET_LOGO_ID = '10000000-0000-4000-8000-000000000011';
const ASSET_STORY_ID = '10000000-0000-4000-8000-000000000012';

function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-api-sdk-feed-'));

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
    platformRepository,
    authService: new AuthService(platformRepository, jwtService, adminAccessService),
    clientTokenService: new ClientTokenService(platformRepository, adminAccessService),
    groupService: new StoryGroupService(contentRepository, publishResolutionService, adminAccessService),
    setService: new StoryGroupSetService(contentRepository, publishResolutionService, adminAccessService),
    storyService: new StoryService(contentRepository, publishResolutionService, adminAccessService),
    sdkFeedService: new SdkFeedService(
      new SdkFeedRepository(publishResolutionService),
      platformRepository,
      new StaticTokenGuard(platformRepository),
    ),
  };
}

test('sdk feed returns a full snapshot for active client and valid static token', async () => {
  const { db, authService, clientTokenService, groupService, setService, storyService, sdkFeedService } = createHarness();
  seedPlacement(db, { id: PLACEMENT_HOME_ID, key: 'home_top_story_bar' });
  seedAsset(db, { id: ASSET_LOGO_ID, kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo.png' });
  seedAsset(db, { id: ASSET_STORY_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story.png' });

  const authorization = await loginAsAdmin(authService);
  const token = await clientTokenService.create({ label: 'SDK Token' }, authorization);
  const group = await groupService.create(
    {
      name: 'Feed Group',
      bottom_label: null,
      logo_asset_id: ASSET_LOGO_ID,
      badge: null,
      story_ids: [],
    },
    authorization,
  );
  const set = await setService.create(
    {
      placement_id: PLACEMENT_HOME_ID,
      name: 'Home Set',
      is_fallback: false,
      targets: [{ platform: 'ios', min_app_version: '1.0.0' }],
      segments: [],
      group_ids: [group.id],
    },
    authorization,
  );

  await groupService.publish(group.id, {}, authorization);
  await setService.publish(set.id, {}, authorization);

  const story = await storyService.create(
    {
      group_id: group.id,
      name: 'Feed Story',
      media_type: 'image',
      asset_id: ASSET_STORY_ID,
      cta: {
        label: 'Open',
        type: 'deeplink',
        value: 'app://story',
      },
    },
    authorization,
  );
  await storyService.publish(story.id, {}, authorization);
  await groupService.publish(group.id, {}, authorization);

  const response = await sdkFeedService.resolve(
    {
      client_id: 'public-client-id',
      placement_key: 'home_top_story_bar',
      platform: 'ios',
      app_version: '2.1.0',
      user_segments: [],
    },
    `Bearer ${token.plainTextToken}`,
  );

  assert.equal(response.client_id, 'public-client-id');
  assert.equal(response.resolved_set?.id, set.id);
  assert.equal(response.resolved_set?.groups[0]?.id, group.id);
  assert.equal(response.resolved_set?.groups[0]?.stories[0]?.id, story.id);
  assert.equal(response.resolved_set?.groups[0]?.stories[0]?.cta?.value, 'app://story');
});

test('sdk feed rejects unauthorized, revoked and inactive client requests', async () => {
  const { db, authService, clientTokenService, groupService, setService, storyService, sdkFeedService, platformRepository } = createHarness();
  seedPlacement(db, { id: PLACEMENT_HOME_ID, key: 'home_top_story_bar' });
  seedAsset(db, { id: ASSET_LOGO_ID, kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo.png' });
  seedAsset(db, { id: ASSET_STORY_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story.png' });

  const authorization = await loginAsAdmin(authService);
  const token = await clientTokenService.create({ label: 'SDK Token' }, authorization);

  const group = await groupService.create(
    {
      name: 'Feed Group',
      bottom_label: null,
      logo_asset_id: ASSET_LOGO_ID,
      badge: null,
      story_ids: [],
    },
    authorization,
  );
  const set = await setService.create(
    {
      placement_id: PLACEMENT_HOME_ID,
      name: 'Home Set',
      is_fallback: false,
      targets: [{ platform: 'ios', min_app_version: '1.0.0' }],
      segments: [],
      group_ids: [group.id],
    },
    authorization,
  );
  await groupService.publish(group.id, {}, authorization);
  await setService.publish(set.id, {}, authorization);
  const story = await storyService.create(
    {
      group_id: group.id,
      name: 'Feed Story',
      media_type: 'image',
      asset_id: ASSET_STORY_ID,
      cta: null,
    },
    authorization,
  );
  await storyService.publish(story.id, {}, authorization);
  await groupService.publish(group.id, {}, authorization);

  await assert.rejects(
    () =>
      sdkFeedService.resolve(
        {
          client_id: 'public-client-id',
          placement_key: 'home_top_story_bar',
          platform: 'ios',
          app_version: '2.1.0',
          user_segments: [],
        },
        undefined,
      ),
    (error) => error instanceof ApiServiceError && error.statusCode === 401,
  );

  await assert.rejects(
    () =>
      sdkFeedService.resolve(
        {
          client_id: 'public-client-id',
          placement_key: 'home_top_story_bar',
          platform: 'ios',
          app_version: '2.1.0',
          user_segments: [],
        },
        'Bearer invalid-token',
      ),
    (error) => error instanceof ApiServiceError && error.statusCode === 401,
  );

  await clientTokenService.revoke(token.token.id, { reason: 'rotate' }, authorization);

  await assert.rejects(
    () =>
      sdkFeedService.resolve(
        {
          client_id: 'public-client-id',
          placement_key: 'home_top_story_bar',
          platform: 'ios',
          app_version: '2.1.0',
          user_segments: [],
        },
        `Bearer ${token.plainTextToken}`,
      ),
    (error) => error instanceof ApiServiceError && error.statusCode === 403,
  );

  const activeToken = await clientTokenService.create({ label: 'SDK Token 2' }, authorization);
  platformRepository.updateSingletonClient({ isActive: false });

  await assert.rejects(
    () =>
      sdkFeedService.resolve(
        {
          client_id: 'public-client-id',
          placement_key: 'home_top_story_bar',
          platform: 'ios',
          app_version: '2.1.0',
          user_segments: [],
        },
        `Bearer ${activeToken.plainTextToken}`,
      ),
    (error) => error instanceof ApiServiceError && error.statusCode === 403,
  );
});

test('sdk feed validates request payload before auth lookup', async () => {
  const { sdkFeedService } = createHarness();

  await assert.rejects(
    () =>
      sdkFeedService.resolve(
        {
          client_id: '',
          placement_key: 'home_top_story_bar',
          platform: 'ios',
          app_version: '2.1.0',
          user_segments: [],
        },
        'Bearer anything',
      ),
    (error) => error instanceof ApiServiceError && error.statusCode === 400,
  );
});

async function loginAsAdmin(authService) {
  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });

  return `Bearer ${loginResponse.accessToken}`;
}

function seedPlacement(db, placement) {
  const now = new Date().toISOString();
  db.insert('placements', {
    id: placement.id,
    key: placement.key,
    name: placement.key,
    description: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

function seedAsset(db, asset) {
  const now = new Date().toISOString();
  db.insert('assets', {
    id: asset.id,
    kind: asset.kind,
    mediaType: asset.mediaType,
    storageKey: `uploads/${asset.id}`,
    publicUrl: asset.publicUrl,
    sourceFileName: `${asset.id}.bin`,
    mimeType: asset.mediaType === 'video' ? 'video/mp4' : 'image/png',
    sizeBytes: 1024,
    width: 1080,
    height: 1920,
    durationMs: asset.mediaType === 'video' ? 4000 : null,
    checksumSha256: `${asset.id}-checksum`,
    createdByAdminUserId: null,
    createdAt: now,
    updatedAt: now,
  });
}
