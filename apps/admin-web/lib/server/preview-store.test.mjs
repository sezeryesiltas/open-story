import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPreviewContractContext, inspectPreviewSetContent } from './preview-inspector.ts';

test('buildPreviewContractContext derives a valid matching contract context from set targets', () => {
  const context = buildPreviewContractContext({
    platformTargets: [{ platform: 'android', minAppVersion: '8.1.0' }],
    userSegments: ['vip', 'beta'],
  });

  assert.deepEqual(context, {
    platform: 'android',
    app_version: '8.1.0',
    user_segments: ['vip', 'beta'],
  });
});

test('inspectPreviewSetContent filters unpublished and archived children while preserving visible order', () => {
  const result = inspectPreviewSetContent({
    storyGroupSet: {
      id: 'set-home',
      name: 'Home Set',
      placementId: 'placement-home',
      minStoryGroupCount: 0,
      maxStoryGroupCount: 10,
      isFallback: false,
      platformTargets: [{ platform: 'ios', minAppVersion: '5.2.0' }],
      userSegments: [],
      groupIds: ['group-visible', 'group-archived', 'group-empty'],
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
      currentDraftRevisionId: 'set-draft',
      currentPublishedRevisionId: null,
    },
    placementKey: 'home_top_story_bar',
    storyGroupsById: new Map([
      [
        'group-visible',
        {
          id: 'group-visible',
          name: 'Visible Group',
          bottomLabel: null,
          currentDraftRevisionId: 'group-visible-draft',
          currentPublishedRevisionId: 'group-visible-published',
          logoAssetId: 'logo-visible',
          badge: null,
          storyIds: ['story-visible', 'story-unpublished', 'story-archived-in-visible-group'],
          storyCount: 3,
          archiveState: 'active',
          publishState: 'published',
          archivedAt: null,
          storyGroupSets: [],
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      ],
      [
        'group-archived',
        {
          id: 'group-archived',
          name: 'Archived Group',
          bottomLabel: null,
          currentDraftRevisionId: 'group-archived-draft',
          currentPublishedRevisionId: 'group-archived-published',
          logoAssetId: 'logo-visible',
          badge: null,
          storyIds: ['story-archived'],
          storyCount: 1,
          archiveState: 'archived',
          publishState: 'published',
          archivedAt: '2026-04-01T10:00:00.000Z',
          storyGroupSets: [],
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      ],
      [
        'group-empty',
        {
          id: 'group-empty',
          name: 'Empty Group',
          bottomLabel: null,
          currentDraftRevisionId: 'group-empty-draft',
          currentPublishedRevisionId: 'group-empty-published',
          logoAssetId: 'logo-visible',
          badge: null,
          storyIds: [],
          storyCount: 0,
          archiveState: 'active',
          publishState: 'published',
          archivedAt: null,
          storyGroupSets: [],
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      ],
    ]),
    storiesById: new Map([
      [
        'story-visible',
        {
          id: 'story-visible',
          name: 'Visible Story',
          currentDraftRevisionId: 'story-visible-draft',
          currentPublishedRevisionId: 'story-visible-published',
          groupId: 'group-visible',
          groupName: 'Visible Group',
          position: 1,
          mediaType: 'image',
          assetId: 'asset-visible',
          posterAssetId: null,
          imageDurationMs: 5000,
          cta: {
            label: 'Open',
            type: 'deeplink',
            value: 'app://story',
          },
          archiveState: 'active',
          publishState: 'published',
          archivedAt: null,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
          canDelete: false,
        },
      ],
      [
        'story-unpublished',
        {
          id: 'story-unpublished',
          name: 'Draft Story',
          currentDraftRevisionId: 'story-unpublished-draft',
          currentPublishedRevisionId: null,
          groupId: 'group-visible',
          groupName: 'Visible Group',
          position: 2,
          mediaType: 'image',
          assetId: 'asset-visible',
          posterAssetId: null,
          imageDurationMs: null,
          cta: null,
          archiveState: 'active',
          publishState: 'unpublished',
          archivedAt: null,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
          canDelete: true,
        },
      ],
      [
        'story-archived',
        {
          id: 'story-archived',
          name: 'Archived Story',
          currentDraftRevisionId: 'story-archived-draft',
          currentPublishedRevisionId: 'story-archived-published',
          groupId: 'group-archived',
          groupName: 'Archived Group',
          position: 1,
          mediaType: 'image',
          assetId: 'asset-visible',
          posterAssetId: null,
          imageDurationMs: null,
          cta: null,
          archiveState: 'archived',
          publishState: 'published',
          archivedAt: '2026-04-01T10:00:00.000Z',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
          canDelete: false,
        },
      ],
      [
        'story-archived-in-visible-group',
        {
          id: 'story-archived-in-visible-group',
          name: 'Archived Story In Visible Group',
          currentDraftRevisionId: 'story-archived-in-visible-group-draft',
          currentPublishedRevisionId: null,
          groupId: 'group-visible',
          groupName: 'Visible Group',
          position: 3,
          mediaType: 'image',
          assetId: 'asset-visible',
          posterAssetId: null,
          imageDurationMs: null,
          cta: null,
          archiveState: 'archived',
          publishState: 'unpublished',
          archivedAt: '2026-04-01T10:00:00.000Z',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
          canDelete: true,
        },
      ],
    ]),
    assetsById: new Map([
      [
        'logo-visible',
        {
          id: 'logo-visible',
          type: 'group_logo',
          url: '/uploads/assets/logo.png',
          name: 'logo.png',
          mimeType: 'image/png',
          width: 200,
          height: 200,
          sizeBytes: 1000,
          source: 'upload',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      ],
      [
        'asset-visible',
        {
          id: 'asset-visible',
          type: 'story_image',
          url: '/uploads/assets/story.png',
          name: 'story.png',
          mimeType: 'image/png',
          width: 900,
          height: 1600,
          sizeBytes: 1000,
          source: 'upload',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      ],
    ]),
    origin: 'http://localhost:3000',
  });

  assert.equal(result.feedSet?.revision_id, 'set-draft');
  assert.equal(result.feedSet?.groups.length, 1);
  assert.equal(result.feedSet?.groups[0].title, 'Visible Group');
  assert.equal(result.feedSet?.groups[0].stories.length, 1);
  assert.equal(result.feedSet?.groups[0].stories[0].asset.url, 'http://localhost:3000/uploads/assets/story.png');
  assert.equal(result.stats.visibleGroupCount, 1);
  assert.equal(result.stats.visibleStoryCount, 1);
  assert.equal(result.stats.hiddenGroupCount, 2);
  assert.equal(result.stats.hiddenStoryCount, 3);
  assert.equal(result.stats.ctaCount, 1);
  assert.deepEqual(
    result.issues.map((issue) => issue.reason),
    ['story_unpublished', 'empty_group'],
  );
});
