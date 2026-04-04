import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DbService } from '@open-story/db';

import { AdminAccessService } from '../src/admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../src/admin-auth/simple-jwt.ts';
import { ApiServiceError } from '../src/common/filters/api-error.ts';
import { StoryGroupService } from '../src/modules/story-group/story-group.service.ts';
import { StoryGroupSetService } from '../src/modules/story-group-set/story-group-set.service.ts';
import { StoryService } from '../src/modules/story/story.service.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { PublishResolutionRepository } from '../src/publish/publish-resolution.repository.ts';
import { PublishResolutionService } from '../src/publish/publish-resolution.service.ts';
import { StoryContentRepository } from '../src/story-content/story-content.repository.ts';
import { StoryPlatformRepository } from '../src/story-platform/story-platform.repository.ts';

const PLACEMENT_HOME_ID = '00000000-0000-4000-8000-000000000001';
const ASSET_LOGO_ID = '00000000-0000-4000-8000-000000000011';
const ASSET_STORY_V1_ID = '00000000-0000-4000-8000-000000000012';
const ASSET_STORY_V2_ID = '00000000-0000-4000-8000-000000000013';
const ASSET_LOGO_1_ID = '00000000-0000-4000-8000-000000000021';
const ASSET_LOGO_2_ID = '00000000-0000-4000-8000-000000000022';
const ASSET_STORY_1_ID = '00000000-0000-4000-8000-000000000023';
const ASSET_STORY_2_ID = '00000000-0000-4000-8000-000000000024';
const ASSET_LOGO_DRAFT_ID = '00000000-0000-4000-8000-000000000031';
const ASSET_STORY_DRAFT_ID = '00000000-0000-4000-8000-000000000032';

function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-api-content-'));

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
    setService: new StoryGroupSetService(contentRepository, publishResolutionService, adminAccessService),
    groupService: new StoryGroupService(contentRepository, publishResolutionService, adminAccessService),
    storyService: new StoryService(contentRepository, publishResolutionService, adminAccessService),
    publishResolutionService,
  };
}

test('story draft revisions and group republish control feed visibility', async () => {
  const { db, authService, groupService, setService, storyService, publishResolutionService } = createHarness();
  seedPlacement(db, { id: PLACEMENT_HOME_ID, key: 'home_top_story_bar' });
  seedAsset(db, { id: ASSET_LOGO_ID, kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo.png' });
  seedAsset(db, { id: ASSET_STORY_V1_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-v1.png' });
  seedAsset(db, { id: ASSET_STORY_V2_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-v2.png' });

  const authorization = await loginAsAdmin(authService);

  const createdGroup = await groupService.create(
    {
      name: 'Promo Group',
      bottom_label: 'Featured',
      logo_asset_id: ASSET_LOGO_ID,
      badge: null,
      story_ids: [],
    },
    authorization,
  );
  const createdSet = await setService.create(
    {
      placement_id: PLACEMENT_HOME_ID,
      name: 'Home Set',
      is_fallback: false,
      targets: [{ platform: 'ios', min_app_version: '1.0.0' }],
      segments: [],
      group_ids: [createdGroup.id],
    },
    authorization,
  );

  await groupService.publish(createdGroup.id, {}, authorization);
  await setService.publish(createdSet.id, {}, authorization);

  assert.equal(
    publishResolutionService.resolveFeed({
      client_id: 'public-client-id',
      placement_key: 'home_top_story_bar',
      platform: 'ios',
      app_version: '1.2.0',
      user_segments: [],
    }),
    null,
  );

  const createdStory = await storyService.create(
    {
      group_id: createdGroup.id,
      name: 'Story v1',
      media_type: 'image',
      asset_id: ASSET_STORY_V1_ID,
      cta: null,
    },
    authorization,
  );

  const groupAfterStoryCreate = await groupService.get(createdGroup.id, authorization);
  assert.deepEqual(groupAfterStoryCreate.story_ids, [createdStory.id]);
  assert.notEqual(groupAfterStoryCreate.current_draft_revision_id, groupAfterStoryCreate.current_published_revision_id);

  assert.equal(
    publishResolutionService.resolveFeed({
      client_id: 'public-client-id',
      placement_key: 'home_top_story_bar',
      platform: 'ios',
      app_version: '1.2.0',
      user_segments: [],
    }),
    null,
  );

  await storyService.publish(createdStory.id, {}, authorization);

  assert.equal(
    publishResolutionService.resolveFeed({
      client_id: 'public-client-id',
      placement_key: 'home_top_story_bar',
      platform: 'ios',
      app_version: '1.2.0',
      user_segments: [],
    }),
    null,
  );

  await groupService.publish(createdGroup.id, {}, authorization);

  const feedAfterGroupPublish = publishResolutionService.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.2.0',
    user_segments: [],
  });

  assert.equal(feedAfterGroupPublish?.groups.length, 1);
  assert.equal(feedAfterGroupPublish?.groups[0]?.stories[0]?.revision_id, createdStory.current_draft_revision_id);
  assert.equal(feedAfterGroupPublish?.groups[0]?.stories[0]?.title, 'Story v1');

  const updatedStory = await storyService.update(
    createdStory.id,
    {
      name: 'Story v2',
      asset_id: ASSET_STORY_V2_ID,
    },
    authorization,
  );

  const feedBeforeStoryRepublish = publishResolutionService.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.2.0',
    user_segments: [],
  });

  assert.equal(feedBeforeStoryRepublish?.groups[0]?.stories[0]?.title, 'Story v1');
  assert.notEqual(feedBeforeStoryRepublish?.groups[0]?.stories[0]?.revision_id, updatedStory.current_draft_revision_id);

  await storyService.publish(createdStory.id, {}, authorization);

  const feedAfterStoryRepublish = publishResolutionService.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.2.0',
    user_segments: [],
  });

  assert.equal(feedAfterStoryRepublish?.groups[0]?.stories[0]?.title, 'Story v2');
  assert.equal(feedAfterStoryRepublish?.groups[0]?.stories[0]?.revision_id, updatedStory.current_draft_revision_id);
});

test('set draft changes require republish and archived groups are filtered at runtime', async () => {
  const { db, authService, groupService, setService, storyService, publishResolutionService } = createHarness();
  seedPlacement(db, { id: PLACEMENT_HOME_ID, key: 'home_top_story_bar' });
  seedAsset(db, { id: ASSET_LOGO_1_ID, kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo-1.png' });
  seedAsset(db, { id: ASSET_LOGO_2_ID, kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo-2.png' });
  seedAsset(db, { id: ASSET_STORY_1_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-1.png' });
  seedAsset(db, { id: ASSET_STORY_2_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-2.png' });

  const authorization = await loginAsAdmin(authService);
  const groupOne = await createPublishedGroup(
    { groupService, storyService },
    authorization,
    {
      name: 'Group One',
      logoAssetId: ASSET_LOGO_1_ID,
      storyName: 'Story One',
      assetId: ASSET_STORY_1_ID,
    },
  );
  const groupTwo = await createPublishedGroup(
    { groupService, storyService },
    authorization,
    {
      name: 'Group Two',
      logoAssetId: ASSET_LOGO_2_ID,
      storyName: 'Story Two',
      assetId: ASSET_STORY_2_ID,
    },
  );

  const createdSet = await setService.create(
    {
      placement_id: PLACEMENT_HOME_ID,
      name: 'Home Set',
      is_fallback: false,
      targets: [{ platform: 'ios', min_app_version: '1.0.0' }],
      segments: [],
      group_ids: [groupOne.group.id],
    },
    authorization,
  );

  await setService.publish(createdSet.id, {}, authorization);

  const feedBeforeSetRepublish = publishResolutionService.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.2.0',
    user_segments: [],
  });
  assert.equal(feedBeforeSetRepublish?.groups.length, 1);
  assert.equal(feedBeforeSetRepublish?.groups[0]?.id, groupOne.group.id);

  const updatedSet = await setService.update(
    createdSet.id,
    {
      group_ids: [groupOne.group.id, groupTwo.group.id],
    },
    authorization,
  );

  assert.deepEqual(updatedSet.group_ids, [groupOne.group.id, groupTwo.group.id]);
  assert.notEqual(updatedSet.current_draft_revision_id, updatedSet.current_published_revision_id);

  const feedStillOldSet = publishResolutionService.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.2.0',
    user_segments: [],
  });
  assert.equal(feedStillOldSet?.groups.length, 1);
  assert.equal(feedStillOldSet?.groups[0]?.id, groupOne.group.id);

  await setService.publish(createdSet.id, {}, authorization);

  const feedAfterSetRepublish = publishResolutionService.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.2.0',
    user_segments: [],
  });
  assert.equal(feedAfterSetRepublish?.groups.length, 2);
  assert.deepEqual(feedAfterSetRepublish?.groups.map((group) => group.id), [groupOne.group.id, groupTwo.group.id]);

  await groupService.archive(groupTwo.group.id, { archived: true }, authorization);

  const feedAfterArchive = publishResolutionService.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.2.0',
    user_segments: [],
  });
  assert.equal(feedAfterArchive?.groups.length, 1);
  assert.equal(feedAfterArchive?.groups[0]?.id, groupOne.group.id);
});

test('group draft update blocks removing an unpublished story from its only group', async () => {
  const { db, authService, groupService, storyService } = createHarness();
  seedPlacement(db, { id: PLACEMENT_HOME_ID, key: 'home_top_story_bar' });
  seedAsset(db, { id: ASSET_LOGO_DRAFT_ID, kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo.png' });
  seedAsset(db, { id: ASSET_STORY_DRAFT_ID, kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story.png' });

  const authorization = await loginAsAdmin(authService);
  const group = await groupService.create(
    {
      name: 'Draft Group',
      bottom_label: null,
      logo_asset_id: ASSET_LOGO_DRAFT_ID,
      badge: null,
      story_ids: [],
    },
    authorization,
  );
  const story = await storyService.create(
    {
      group_id: group.id,
      name: 'Draft Story',
      media_type: 'image',
      asset_id: ASSET_STORY_DRAFT_ID,
      cta: null,
    },
    authorization,
  );

  await assert.rejects(
    () =>
      groupService.update(
        group.id,
        {
          story_ids: [],
        },
        authorization,
      ),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 409 &&
      error.message.includes(story.id),
  );
});

async function createPublishedGroup(services, authorization, params) {
  const group = await services.groupService.create(
    {
      name: params.name,
      bottom_label: null,
      logo_asset_id: params.logoAssetId,
      badge: null,
      story_ids: [],
    },
    authorization,
  );
  await services.groupService.publish(group.id, {}, authorization);

  const story = await services.storyService.create(
    {
      group_id: group.id,
      name: params.storyName,
      media_type: 'image',
      asset_id: params.assetId,
      cta: null,
    },
    authorization,
  );
  await services.storyService.publish(story.id, {}, authorization);
  const publishedGroup = await services.groupService.publish(group.id, {}, authorization);

  return { group: publishedGroup, story };
}

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
    source: asset.source ?? 'upload',
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
