import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  clientRecordSchema,
  storyGroupSetRevisionRecordSchema,
  storyPlatformTableNames,
  storyRevisionRecordSchema,
} from './persistence.ts';

test('story platform tables cover auth, content roots, revisions and compositions', () => {
  assert.deepEqual(storyPlatformTableNames, [
    'clients',
    'staticTokens',
    'adminUsers',
    'adminSessions',
    'placements',
    'assets',
    'storyGroupSets',
    'storyGroupSetRevisions',
    'storyGroupSetRevisionGroups',
    'storyGroups',
    'storyGroupRevisions',
    'storyGroupRevisionStories',
    'stories',
    'storyRevisions',
  ]);
});

test('client and revision persistence schemas validate canonical root-revision records', () => {
  const now = new Date().toISOString();

  const clientRecord = clientRecordSchema.parse({
    id: randomUUID(),
    clientId: 'public-client-id',
    name: 'Open Story App',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const setRevisionRecord = storyGroupSetRevisionRecordSchema.parse({
    id: randomUUID(),
    storyGroupSetId: randomUUID(),
    revisionNumber: 1,
    name: 'Home VIP Set',
    status: 'draft',
    platformTargets: [{ platform: 'ios', minAppVersion: '5.2.0' }],
    userSegments: ['vip'],
    createdByAdminUserId: randomUUID(),
    createdAt: now,
  });

  const storyRevisionRecord = storyRevisionRecordSchema.parse({
    id: randomUUID(),
    storyId: randomUUID(),
    revisionNumber: 2,
    name: 'Spring Launch',
    mediaType: 'image',
    assetId: randomUUID(),
    posterAssetId: null,
    imageDurationMs: 5000,
    cta: {
      label: 'Shop now',
      type: 'deeplink',
      value: 'app://launch',
    },
    status: 'published',
    createdByAdminUserId: null,
    createdAt: now,
  });

  assert.equal(clientRecord.clientId, 'public-client-id');
  assert.equal(setRevisionRecord.platformTargets[0].minAppVersion, '5.2.0');
  assert.equal(storyRevisionRecord.cta?.value, 'app://launch');
});
