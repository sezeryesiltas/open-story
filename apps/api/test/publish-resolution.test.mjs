import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DbService } from '@open-story/db';

import { ApiServiceError } from '../src/common/filters/api-error.ts';
import { PublishResolutionRepository } from '../src/publish/publish-resolution.repository.ts';
import { PublishResolutionService } from '../src/publish/publish-resolution.service.ts';

function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-api-publish-'));

  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');

  const db = new DbService();
  const repository = new PublishResolutionRepository(db);
  const service = new PublishResolutionService(repository);

  return { db, repository, service };
}

test('set publish blocks ambiguous targeting and duplicate fallback within a placement', () => {
  const { db, service } = createHarness();

  seedPlacement(db, { id: 'placement-home', key: 'home_top_story_bar' });

  seedSet(db, {
    id: 'set-existing',
    placementId: 'placement-home',
    isFallback: false,
    currentDraftRevisionId: 'set-existing-draft',
    currentPublishedRevisionId: 'set-existing-published',
    revisions: [
      {
        id: 'set-existing-draft',
        revisionNumber: 1,
        name: 'Existing draft',
        platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
        userSegments: ['vip'],
        groupIds: [],
        status: 'draft',
      },
      {
        id: 'set-existing-published',
        revisionNumber: 2,
        name: 'Existing published',
        platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
        userSegments: ['vip'],
        groupIds: [],
        status: 'published',
      },
    ],
  });

  seedSet(db, {
    id: 'set-candidate',
    placementId: 'placement-home',
    isFallback: false,
    currentDraftRevisionId: 'set-candidate-draft',
    currentPublishedRevisionId: null,
    revisions: [
      {
        id: 'set-candidate-draft',
        revisionNumber: 1,
        name: 'Candidate draft',
        platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
        userSegments: ['vip'],
        groupIds: [],
        status: 'draft',
      },
    ],
  });

  assert.throws(
    () => service.publishSet({ setId: 'set-candidate' }),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 409 &&
      error.message.includes('Targeting conflict'),
  );

  seedSet(db, {
    id: 'set-fallback-existing',
    placementId: 'placement-home',
    isFallback: true,
    currentDraftRevisionId: 'set-fallback-existing-draft',
    currentPublishedRevisionId: 'set-fallback-existing-published',
    revisions: [
      {
        id: 'set-fallback-existing-draft',
        revisionNumber: 1,
        name: 'Fallback draft',
        platformTargets: [],
        userSegments: [],
        groupIds: [],
        status: 'draft',
      },
      {
        id: 'set-fallback-existing-published',
        revisionNumber: 2,
        name: 'Fallback published',
        platformTargets: [],
        userSegments: [],
        groupIds: [],
        status: 'published',
      },
    ],
  });

  seedSet(db, {
    id: 'set-fallback-candidate',
    placementId: 'placement-home',
    isFallback: true,
    currentDraftRevisionId: 'set-fallback-candidate-draft',
    currentPublishedRevisionId: null,
    revisions: [
      {
        id: 'set-fallback-candidate-draft',
        revisionNumber: 1,
        name: 'Fallback candidate draft',
        platformTargets: [],
        userSegments: [],
        groupIds: [],
        status: 'draft',
      },
    ],
  });

  assert.throws(
    () => service.publishSet({ setId: 'set-fallback-candidate' }),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 409 &&
      error.message.includes('fallback'),
  );
});

test('resolution uses published revisions, shared group/story updates, and filters unpublished children', () => {
  const { db, service } = createHarness();

  seedPlacement(db, { id: 'placement-home', key: 'home_top_story_bar' });
  seedAsset(db, { id: 'asset-logo', kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo.png' });
  seedAsset(db, { id: 'asset-story-v1', kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-v1.png' });
  seedAsset(db, { id: 'asset-story-v2', kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-v2.png' });
  seedAsset(db, { id: 'asset-story-hidden', kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-hidden.png' });

  seedStory(db, {
    id: 'story-visible',
    currentDraftRevisionId: 'story-visible-r2',
    currentPublishedRevisionId: 'story-visible-r1',
    revisions: [
      { id: 'story-visible-r1', revisionNumber: 1, name: 'Visible story v1', mediaType: 'image', assetId: 'asset-story-v1', posterAssetId: null, imageDurationMs: 5000, cta: null, status: 'published' },
      { id: 'story-visible-r2', revisionNumber: 2, name: 'Visible story v2', mediaType: 'image', assetId: 'asset-story-v2', posterAssetId: null, imageDurationMs: 6000, cta: null, status: 'draft' },
    ],
  });
  seedStory(db, {
    id: 'story-hidden',
    currentDraftRevisionId: 'story-hidden-r1',
    currentPublishedRevisionId: null,
    revisions: [
      { id: 'story-hidden-r1', revisionNumber: 1, name: 'Hidden story', mediaType: 'image', assetId: 'asset-story-hidden', posterAssetId: null, imageDurationMs: 5000, cta: null, status: 'draft' },
    ],
  });

  seedGroup(db, {
    id: 'group-shared',
    currentDraftRevisionId: 'group-shared-r2',
    currentPublishedRevisionId: 'group-shared-r1',
    revisions: [
      { id: 'group-shared-r1', revisionNumber: 1, name: 'Shared Group v1', bottomLabel: null, logoAssetId: 'asset-logo', badge: null, storyIds: ['story-visible'], status: 'published' },
      { id: 'group-shared-r2', revisionNumber: 2, name: 'Shared Group v2', bottomLabel: null, logoAssetId: 'asset-logo', badge: null, storyIds: ['story-visible', 'story-hidden'], status: 'draft' },
    ],
  });

  seedSet(db, {
    id: 'set-vip',
    placementId: 'placement-home',
    isFallback: false,
    currentDraftRevisionId: 'set-vip-r1',
    currentPublishedRevisionId: 'set-vip-r1',
    revisions: [
      { id: 'set-vip-r1', revisionNumber: 1, name: 'VIP Set', platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }], userSegments: ['vip'], groupIds: ['group-shared'], status: 'published' },
    ],
  });
  seedSet(db, {
    id: 'set-default',
    placementId: 'placement-home',
    isFallback: false,
    currentDraftRevisionId: 'set-default-r1',
    currentPublishedRevisionId: 'set-default-r1',
    revisions: [
      { id: 'set-default-r1', revisionNumber: 1, name: 'Default Set', platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }], userSegments: [], groupIds: ['group-shared'], status: 'published' },
    ],
  });

  const beforeStoryPublish = service.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '6.1.0',
    user_segments: ['vip'],
  });

  assert.equal(beforeStoryPublish?.id, 'set-vip');
  assert.equal(beforeStoryPublish?.groups[0]?.revision_id, 'group-shared-r1');
  assert.equal(beforeStoryPublish?.groups[0]?.stories.length, 1);
  assert.equal(beforeStoryPublish?.groups[0]?.stories[0]?.revision_id, 'story-visible-r1');

  service.publishStory({ storyId: 'story-visible' });

  const afterStoryPublish = service.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '6.1.0',
    user_segments: ['vip'],
  });

  assert.equal(afterStoryPublish?.revision_id, 'set-vip-r1');
  assert.equal(afterStoryPublish?.groups[0]?.revision_id, 'group-shared-r1');
  assert.equal(afterStoryPublish?.groups[0]?.stories[0]?.revision_id, 'story-visible-r2');

  service.publishGroup({ groupId: 'group-shared' });

  const afterGroupPublish = service.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '6.1.0',
    user_segments: ['vip'],
  });

  assert.equal(afterGroupPublish?.revision_id, 'set-vip-r1');
  assert.equal(afterGroupPublish?.groups[0]?.revision_id, 'group-shared-r2');
  assert.equal(afterGroupPublish?.groups[0]?.stories.length, 1);
  assert.equal(afterGroupPublish?.groups[0]?.stories[0]?.revision_id, 'story-visible-r2');
});

test('resolution falls back when the selected set becomes empty after runtime child filtering', () => {
  const { db, service } = createHarness();

  seedPlacement(db, { id: 'placement-home', key: 'home_top_story_bar' });
  seedAsset(db, { id: 'asset-logo-primary', kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo-primary.png' });
  seedAsset(db, { id: 'asset-logo-fallback', kind: 'group_logo', mediaType: 'image', publicUrl: 'https://cdn.example.com/logo-fallback.png' });
  seedAsset(db, { id: 'asset-story-fallback', kind: 'story_image', mediaType: 'image', publicUrl: 'https://cdn.example.com/story-fallback.png' });

  seedStory(db, {
    id: 'story-primary-hidden',
    currentDraftRevisionId: 'story-primary-hidden-r1',
    currentPublishedRevisionId: null,
    revisions: [
      { id: 'story-primary-hidden-r1', revisionNumber: 1, name: 'Primary hidden', mediaType: 'image', assetId: 'asset-story-fallback', posterAssetId: null, imageDurationMs: 5000, cta: null, status: 'draft' },
    ],
  });
  seedStory(db, {
    id: 'story-fallback',
    currentDraftRevisionId: 'story-fallback-r1',
    currentPublishedRevisionId: 'story-fallback-r1',
    revisions: [
      { id: 'story-fallback-r1', revisionNumber: 1, name: 'Fallback story', mediaType: 'image', assetId: 'asset-story-fallback', posterAssetId: null, imageDurationMs: 5000, cta: null, status: 'published' },
    ],
  });

  seedGroup(db, {
    id: 'group-primary',
    currentDraftRevisionId: 'group-primary-r1',
    currentPublishedRevisionId: 'group-primary-r1',
    revisions: [
      { id: 'group-primary-r1', revisionNumber: 1, name: 'Primary group', bottomLabel: null, logoAssetId: 'asset-logo-primary', badge: null, storyIds: ['story-primary-hidden'], status: 'published' },
    ],
  });
  seedGroup(db, {
    id: 'group-fallback',
    currentDraftRevisionId: 'group-fallback-r1',
    currentPublishedRevisionId: 'group-fallback-r1',
    revisions: [
      { id: 'group-fallback-r1', revisionNumber: 1, name: 'Fallback group', bottomLabel: null, logoAssetId: 'asset-logo-fallback', badge: null, storyIds: ['story-fallback'], status: 'published' },
    ],
  });

  seedSet(db, {
    id: 'set-primary',
    placementId: 'placement-home',
    isFallback: false,
    currentDraftRevisionId: 'set-primary-r1',
    currentPublishedRevisionId: 'set-primary-r1',
    revisions: [
      { id: 'set-primary-r1', revisionNumber: 1, name: 'Primary Set', platformTargets: [{ platform: 'ios', minAppVersion: '1.0.0' }], userSegments: [], groupIds: ['group-primary'], status: 'published' },
    ],
  });
  seedSet(db, {
    id: 'set-fallback',
    placementId: 'placement-home',
    isFallback: true,
    currentDraftRevisionId: 'set-fallback-r1',
    currentPublishedRevisionId: 'set-fallback-r1',
    revisions: [
      { id: 'set-fallback-r1', revisionNumber: 1, name: 'Fallback Set', platformTargets: [], userSegments: [], groupIds: ['group-fallback'], status: 'published' },
    ],
  });

  const resolvedFeed = service.resolveFeed({
    client_id: 'public-client-id',
    placement_key: 'home_top_story_bar',
    platform: 'ios',
    app_version: '1.0.0',
    user_segments: [],
  });

  assert.equal(resolvedFeed?.id, 'set-fallback');
  assert.equal(resolvedFeed?.groups.length, 1);
  assert.equal(resolvedFeed?.groups[0]?.stories[0]?.id, 'story-fallback');
});

function seedPlacement(db, placement) {
  const now = new Date().toISOString();
  db.insert('placements', {
    id: placement.id,
    key: placement.key,
    name: placement.name ?? placement.key,
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
    storageKey: asset.storageKey ?? `${asset.kind}/${asset.id}`,
    publicUrl: asset.publicUrl,
    sourceFileName: asset.sourceFileName ?? `${asset.id}.bin`,
    mimeType: asset.mimeType ?? (asset.mediaType === 'video' ? 'video/mp4' : 'image/png'),
    sizeBytes: asset.sizeBytes ?? 1024,
    width: asset.width ?? 1080,
    height: asset.height ?? 1920,
    durationMs: asset.durationMs ?? (asset.mediaType === 'video' ? 15000 : null),
    checksumSha256: asset.checksumSha256 ?? `sha256-${asset.id}`,
    createdByAdminUserId: null,
    createdAt: now,
    updatedAt: now,
  });
}

function seedStory(db, story) {
  const now = new Date().toISOString();
  db.insert('stories', {
    id: story.id,
    name: story.name ?? story.id,
    isArchived: false,
    currentDraftRevisionId: story.currentDraftRevisionId,
    currentPublishedRevisionId: story.currentPublishedRevisionId,
    createdAt: now,
    updatedAt: now,
  });

  for (const revision of story.revisions) {
    db.insert('storyRevisions', {
      id: revision.id,
      storyId: story.id,
      revisionNumber: revision.revisionNumber,
      name: revision.name,
      mediaType: revision.mediaType,
      assetId: revision.assetId,
      posterAssetId: revision.posterAssetId,
      imageDurationMs: revision.imageDurationMs,
      cta: revision.cta,
      status: revision.status,
      createdByAdminUserId: null,
      createdAt: now,
    });
  }
}

function seedGroup(db, group) {
  const now = new Date().toISOString();
  db.insert('storyGroups', {
    id: group.id,
    name: group.name ?? group.id,
    isArchived: false,
    currentDraftRevisionId: group.currentDraftRevisionId,
    currentPublishedRevisionId: group.currentPublishedRevisionId,
    createdAt: now,
    updatedAt: now,
  });

  for (const revision of group.revisions) {
    db.insert('storyGroupRevisions', {
      id: revision.id,
      storyGroupId: group.id,
      revisionNumber: revision.revisionNumber,
      name: revision.name,
      bottomLabel: revision.bottomLabel,
      logoAssetId: revision.logoAssetId,
      badge: revision.badge,
      status: revision.status,
      createdByAdminUserId: null,
      createdAt: now,
    });

    for (const [sortOrder, storyId] of revision.storyIds.entries()) {
      db.insert('storyGroupRevisionStories', {
        id: `${revision.id}:story:${storyId}`,
        storyGroupRevisionId: revision.id,
        storyId,
        sortOrder,
        createdAt: now,
      });
    }
  }
}

function seedSet(db, set) {
  const now = new Date().toISOString();
  db.insert('storyGroupSets', {
    id: set.id,
    placementId: set.placementId,
    name: set.name ?? set.id,
    isFallback: set.isFallback,
    isArchived: false,
    currentDraftRevisionId: set.currentDraftRevisionId,
    currentPublishedRevisionId: set.currentPublishedRevisionId,
    createdAt: now,
    updatedAt: now,
  });

  for (const revision of set.revisions) {
    db.insert('storyGroupSetRevisions', {
      id: revision.id,
      storyGroupSetId: set.id,
      revisionNumber: revision.revisionNumber,
      name: revision.name,
      status: revision.status,
      platformTargets: revision.platformTargets,
      userSegments: revision.userSegments,
      createdByAdminUserId: null,
      createdAt: now,
    });

    for (const [sortOrder, groupId] of revision.groupIds.entries()) {
      db.insert('storyGroupSetRevisionGroups', {
        id: `${revision.id}:group:${groupId}`,
        storyGroupSetRevisionId: revision.id,
        storyGroupId: groupId,
        sortOrder,
        createdAt: now,
      });
    }
  }
}
