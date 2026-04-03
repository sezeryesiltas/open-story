import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStoryArchivePatch } from './story-lifecycle.ts';

test('buildStoryArchivePatch clears published revision when archiving', () => {
  const archivedPatch = buildStoryArchivePatch({
    archived: true,
    now: '2026-04-02T10:00:00.000Z',
  });

  assert.deepEqual(archivedPatch, {
    archivedAt: '2026-04-02T10:00:00.000Z',
    currentPublishedRevisionId: null,
    updatedAt: '2026-04-02T10:00:00.000Z',
  });

  const restoredPatch = buildStoryArchivePatch({
    archived: false,
    now: '2026-04-02T10:05:00.000Z',
  });

  assert.deepEqual(restoredPatch, {
    archivedAt: null,
    updatedAt: '2026-04-02T10:05:00.000Z',
  });
});
