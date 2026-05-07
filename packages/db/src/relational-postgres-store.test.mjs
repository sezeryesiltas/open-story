import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRelationalImportPlan } from './relational-postgres-store.ts';

test('relational import skips non-current story revisions with missing assets', () => {
  const now = new Date().toISOString();
  const plan = buildRelationalImportPlan([
    record('assets', {
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: now,
      updatedAt: now,
    }),
    record('stories', {
      id: '00000000-0000-0000-0000-000000000010',
      currentDraftRevisionId: '00000000-0000-0000-0000-000000000011',
      currentPublishedRevisionId: null,
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000011',
      assetId: '00000000-0000-0000-0000-000000000001',
      mediaType: 'image',
    }),
    record('storyRevisions', {
      id: '00000000-0000-0000-0000-000000000012',
      assetId: '00000000-0000-0000-0000-000000000099',
      mediaType: 'image',
    }),
  ]);

  assert.deepEqual(
    plan.get('storyRevisions')?.map((revision) => revision.id),
    ['00000000-0000-0000-0000-000000000011'],
  );
});

test('relational import blocks current story revisions with missing assets', () => {
  const now = new Date().toISOString();

  assert.throws(
    () =>
      buildRelationalImportPlan([
        record('stories', {
          id: '00000000-0000-0000-0000-000000000010',
          currentDraftRevisionId: '00000000-0000-0000-0000-000000000011',
          currentPublishedRevisionId: null,
        }),
        record('storyRevisions', {
          id: '00000000-0000-0000-0000-000000000011',
          assetId: '00000000-0000-0000-0000-000000000099',
          mediaType: 'image',
          createdAt: now,
        }),
      ]),
    /current story revision .* references missing media asset/,
  );
});

function record(tableName, payload) {
  return {
    tableName,
    id: payload.id,
    payload: JSON.stringify(payload),
    updatedAt: payload.updatedAt ?? payload.createdAt ?? '',
  };
}
