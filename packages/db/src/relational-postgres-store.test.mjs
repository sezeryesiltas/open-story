import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRelationalImportPlan } from './relational-postgres-store.ts';

test('relational import skips non-current story revisions with missing assets', () => {
  const now = new Date().toISOString();
  const storyId = '00000000-0000-0000-0000-000000000010';
  const plan = buildRelationalImportPlan([
    record('assets', {
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: now,
      updatedAt: now,
    }),
    record('stories', {
      id: storyId,
      currentDraftRevisionId: '00000000-0000-0000-0000-000000000011',
      currentPublishedRevisionId: null,
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000011',
      storyId,
      revisionNumber: 1,
      assetId: '00000000-0000-0000-0000-000000000001',
      mediaType: 'image',
      status: 'draft',
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000012',
      storyId,
      revisionNumber: 2,
      assetId: '00000000-0000-0000-0000-000000000099',
      mediaType: 'image',
      status: 'draft',
    }),
  ]);

  assert.deepEqual(
    plan.get('storyRevisions')?.map((revision) => revision.id),
    ['00000000-0000-0000-0000-000000000011'],
  );
});

test('relational import repairs current story revisions with missing assets', () => {
  const now = new Date().toISOString();
  const storyId = '00000000-0000-0000-0000-000000000010';
  const plan = buildRelationalImportPlan([
    record('assets', {
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: now,
      updatedAt: now,
    }),
    record('stories', {
      id: storyId,
      currentDraftRevisionId: '00000000-0000-0000-0000-000000000012',
      currentPublishedRevisionId: '00000000-0000-0000-0000-000000000013',
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000011',
      storyId,
      revisionNumber: 1,
      assetId: '00000000-0000-0000-0000-000000000001',
      mediaType: 'image',
      status: 'draft',
      createdAt: now,
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000012',
      storyId,
      revisionNumber: 2,
      assetId: '00000000-0000-0000-0000-000000000099',
      mediaType: 'image',
      status: 'draft',
      createdAt: now,
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000013',
      storyId,
      revisionNumber: 3,
      assetId: '00000000-0000-0000-0000-000000000099',
      mediaType: 'image',
      status: 'published',
      createdAt: now,
    }),
  ]);

  assert.deepEqual(
    plan.get('storyRevisions')?.map((revision) => revision.id),
    ['00000000-0000-0000-0000-000000000011'],
  );
  assert.deepEqual(plan.get('stories')?.[0], {
    id: storyId,
    currentDraftRevisionId: '00000000-0000-0000-0000-000000000011',
    currentPublishedRevisionId: null,
  });
});

test('relational import skips stories with no valid revisions and removes group composition', () => {
  const now = new Date().toISOString();
  const storyId = '00000000-0000-0000-0000-000000000010';
  const groupId = '00000000-0000-0000-0000-000000000020';
  const groupRevisionId = '00000000-0000-0000-0000-000000000021';
  const plan = buildRelationalImportPlan([
    record('assets', {
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: now,
      updatedAt: now,
    }),
    record('storyGroups', {
      id: groupId,
      currentDraftRevisionId: groupRevisionId,
      currentPublishedRevisionId: null,
    }),
    record('storyGroupRevisions', {
      id: groupRevisionId,
      storyGroupId: groupId,
      revisionNumber: 1,
      logoAssetId: '00000000-0000-0000-0000-000000000001',
      status: 'draft',
    }),
    record('stories', {
      id: storyId,
      currentDraftRevisionId: '00000000-0000-0000-0000-000000000011',
      currentPublishedRevisionId: null,
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000011',
      storyId,
      revisionNumber: 1,
      assetId: '00000000-0000-0000-0000-000000000099',
      mediaType: 'image',
      status: 'draft',
    }),
    record('storyGroupRevisionStories', {
      id: '00000000-0000-0000-0000-000000000030',
      storyGroupRevisionId: groupRevisionId,
      storyId,
      sortOrder: 0,
      createdAt: now,
    }),
  ]);

  assert.equal(plan.get('stories')?.length, 0);
  assert.equal(plan.get('storyRevisions')?.length, 0);
  assert.equal(plan.get('storyGroupRevisionStories')?.length, 0);
});

test('relational import skips groups with no valid revisions and removes set composition', () => {
  const now = new Date().toISOString();
  const groupId = '00000000-0000-0000-0000-000000000020';
  const setRevisionId = '00000000-0000-0000-0000-000000000031';
  const plan = buildRelationalImportPlan([
    record('assets', {
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: now,
      updatedAt: now,
    }),
    record('storyGroups', {
      id: groupId,
      currentDraftRevisionId: '00000000-0000-0000-0000-000000000021',
      currentPublishedRevisionId: null,
    }),
    record('storyGroupRevisions', {
      id: '00000000-0000-0000-0000-000000000021',
      storyGroupId: groupId,
      revisionNumber: 1,
      logoAssetId: '00000000-0000-0000-0000-000000000099',
      status: 'draft',
    }),
    record('storyGroupSetRevisions', {
      id: setRevisionId,
    }),
    record('storyGroupSetRevisionGroups', {
      id: '00000000-0000-0000-0000-000000000040',
      storyGroupSetRevisionId: setRevisionId,
      storyGroupId: groupId,
      sortOrder: 0,
      createdAt: now,
    }),
  ]);

  assert.equal(plan.get('storyGroups')?.length, 0);
  assert.equal(plan.get('storyGroupRevisions')?.length, 0);
  assert.equal(plan.get('storyGroupSetRevisionGroups')?.length, 0);
});

function record(tableName, payload) {
  return {
    tableName,
    id: payload.id,
    payload: JSON.stringify(payload),
    updatedAt: payload.updatedAt ?? payload.createdAt ?? '',
  };
}
