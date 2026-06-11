import assert from 'node:assert/strict';
import test from 'node:test';

import { createStory, listAssets, publishStoryGroup } from './admin-bff.ts';

test('createStory forwards position and avoids extra story move/read calls', async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.OPEN_STORY_API_BASE_URL;
  const calls = [];

  process.env.OPEN_STORY_API_BASE_URL = 'http://backend.test';
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body });

    if (url === 'http://backend.test/v1/stories' && method === 'POST') {
      return Response.json({
        id: 'story-created',
        current_draft_revision_id: 'story-revision-created',
        current_published_revision_id: null,
        created_at: '2026-04-02T10:00:00.000Z',
        updated_at: '2026-04-02T10:00:00.000Z',
        group_id: 'group-1',
        name: 'Inserted Story',
        media_type: 'image',
        asset_id: 'asset-1',
        poster_asset_id: null,
        image_duration_ms: null,
        cta: null,
        archived_at: null,
      });
    }

    if (url === 'http://backend.test/v1/story-groups/group-1' && method === 'GET') {
      return Response.json({
        id: 'group-1',
        current_draft_revision_id: 'group-revision-1',
        current_published_revision_id: null,
        created_at: '2026-04-02T09:00:00.000Z',
        updated_at: '2026-04-02T10:00:00.000Z',
        name: 'Group 1',
        bottom_label: null,
        logo_asset_id: 'logo-1',
        badge: null,
        story_ids: ['story-existing', 'story-created'],
        archived_at: null,
      });
    }

    throw new Error(`Unexpected backend request: ${method} ${url}`);
  };

  try {
    const createdStory = await createStory(
      {
        group_id: 'group-1',
        position: 2,
        name: 'Inserted Story',
        media_type: 'image',
        asset_id: 'asset-1',
        poster_asset_id: null,
        image_duration_ms: null,
        cta: null,
      },
      'admin-token',
    );

    assert.deepEqual(
      calls.map((call) => `${call.method} ${new URL(call.url).pathname}`),
      ['POST /v1/stories', 'GET /v1/story-groups/group-1'],
    );
    assert.equal(JSON.parse(String(calls[0].body)).position, 2);
    assert.equal(createdStory.position, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.OPEN_STORY_API_BASE_URL;
    } else {
      process.env.OPEN_STORY_API_BASE_URL = originalBaseUrl;
    }
  }
});

test('publishStoryGroup fetches only Story Bars that reference the group', async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.OPEN_STORY_API_BASE_URL;
  const calls = [];

  process.env.OPEN_STORY_API_BASE_URL = 'http://backend.test';
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body });

    if (url === 'http://backend.test/v1/story-groups/group-1/publish' && method === 'POST') {
      return Response.json({
        id: 'group-1',
        current_draft_revision_id: 'group-revision-2',
        current_published_revision_id: 'group-revision-2',
        created_at: '2026-04-02T09:00:00.000Z',
        updated_at: '2026-04-02T10:00:00.000Z',
        name: 'Group 1',
        bottom_label: null,
        logo_asset_id: 'logo-1',
        badge: null,
        story_ids: ['story-1'],
        archived_at: null,
      });
    }

    if (url === 'http://backend.test/v1/story-group-sets?group_id=group-1' && method === 'GET') {
      return Response.json([
        {
          id: 'set-1',
          current_draft_revision_id: 'set-revision-1',
          current_published_revision_id: 'set-revision-1',
          created_at: '2026-04-02T09:00:00.000Z',
          updated_at: '2026-04-02T10:00:00.000Z',
          placement_id: 'placement-1',
          name: 'Home Set',
          is_fallback: false,
          targets: [],
          segments: [],
          group_ids: ['group-1'],
          archived_at: null,
        },
      ]);
    }

    throw new Error(`Unexpected backend request: ${method} ${url}`);
  };

  try {
    const storyGroup = await publishStoryGroup('group-1', {}, 'admin-token');

    assert.deepEqual(
      calls.map((call) => `${call.method} ${new URL(call.url).pathname}${new URL(call.url).search}`),
      ['POST /v1/story-groups/group-1/publish', 'GET /v1/story-group-sets?group_id=group-1'],
    );
    assert.deepEqual(storyGroup.storyGroupSets.map((storyGroupSet) => storyGroupSet.id), ['set-1']);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.OPEN_STORY_API_BASE_URL;
    } else {
      process.env.OPEN_STORY_API_BASE_URL = originalBaseUrl;
    }
  }
});

test('listAssets can request assets without usage references', async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.OPEN_STORY_API_BASE_URL;
  const calls = [];

  process.env.OPEN_STORY_API_BASE_URL = 'http://backend.test';
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? 'GET' });

    return Response.json([
      {
        id: 'asset-1',
        type: 'story_image',
        url: 'https://cdn.example.com/story.png',
        name: 'story.png',
        mimeType: 'image/png',
        width: 1080,
        height: 1920,
        durationMs: null,
        sizeBytes: 1024,
        source: 'upload',
        usageCount: 0,
        usageReferences: [],
        createdAt: '2026-04-02T09:00:00.000Z',
        updatedAt: '2026-04-02T09:00:00.000Z',
      },
    ]);
  };

  try {
    const assets = await listAssets('story_image', 'admin-token', { includeUsage: false });

    assert.equal(assets.length, 1);
    assert.deepEqual(
      calls.map((call) => `${call.method} ${new URL(call.url).pathname}${new URL(call.url).search}`),
      ['GET /v1/assets?type=story_image&include_usage=false'],
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.OPEN_STORY_API_BASE_URL;
    } else {
      process.env.OPEN_STORY_API_BASE_URL = originalBaseUrl;
    }
  }
});
