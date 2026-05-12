import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAdminCurrentPublishedRevisionId,
  getAdminPublishState,
} from './admin-record-state.ts';

test('archived admin records are treated as unpublished even with a stale published revision id', () => {
  assert.equal(
    getAdminCurrentPublishedRevisionId(
      '2026-04-02T10:00:00.000Z',
      'stale-published-revision',
    ),
    null,
  );
  assert.equal(
    getAdminPublishState(
      '2026-04-02T10:00:00.000Z',
      'stale-published-revision',
    ),
    'unpublished',
  );
});

test('active admin records keep their published revision state', () => {
  assert.equal(getAdminCurrentPublishedRevisionId(null, 'published-revision'), 'published-revision');
  assert.equal(getAdminPublishState(null, 'published-revision'), 'published');
  assert.equal(getAdminPublishState(null, null), 'unpublished');
});
