import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { storyPlatformTableNames } from '../../contracts/src/persistence.ts';
import { DbService } from './db.service.ts';

test('DbService tracks counts for canonical story platform tables', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-db-phase1-'));
  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');

  const db = new DbService();
  const now = new Date().toISOString();

  db.insert('clients', {
    id: randomUUID(),
    clientId: 'public-client-id',
    name: 'Open Story App',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  db.insert('storyGroupSetRevisions', {
    id: randomUUID(),
    storyGroupSetId: randomUUID(),
    revisionNumber: 1,
    name: 'Home Feed',
    status: 'draft',
    platformTargets: [{ platform: 'ios', minAppVersion: '5.2.0' }],
    userSegments: [],
    createdByAdminUserId: null,
    createdAt: now,
  });

  const settings = db.getDatabaseSettings();

  assert.deepEqual(Object.keys(settings.tableCounts), storyPlatformTableNames);
  assert.equal(settings.tableCounts.clients, 1);
  assert.equal(settings.tableCounts.storyGroupSetRevisions, 1);
  assert.equal(settings.tableCounts.storyRevisions, 0);
  assert.equal(db.list('storyGroupSetRevisions').length, 1);
});
