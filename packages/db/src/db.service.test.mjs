import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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

test('DbService preserves sqlite external database migration flow', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-db-sqlite-external-'));
  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');

  const db = new DbService();
  const now = new Date().toISOString();
  const client = db.insert('clients', {
    id: randomUUID(),
    clientId: 'public-client-id',
    name: 'Open Story App',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const externalUrl = pathToFileURL(join(tempDir, 'external-open-story.sqlite')).href;

  const settings = db.updateDatabaseSettings(externalUrl);

  assert.equal(settings.activeProvider, 'sqlite');
  assert.equal(settings.activeDatabaseUrl, externalUrl);
  assert.equal(settings.externalDatabaseUrl, externalUrl);
  assert.equal(settings.mysqlDatabase, null);
  assert.equal(settings.tableCounts.clients, 1);
  assert.deepEqual(db.findById('clients', client.id), client);
});

test('DbService tests sqlite external connection without switching active database', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-db-sqlite-test-'));
  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');

  const db = new DbService();
  const externalUrl = pathToFileURL(join(tempDir, 'test-open-story.sqlite')).href;

  const result = db.testDatabaseConnection({
    externalDatabaseUrl: externalUrl,
  });
  const settings = db.getDatabaseSettings();

  assert.equal(result.ok, true);
  assert.equal(result.provider, 'sqlite');
  assert.equal(result.resolvedDatabaseUrl, externalUrl);
  assert.equal(settings.activeProvider, 'sqlite');
  assert.equal(settings.externalDatabaseUrl, null);
  assert.equal(settings.activeDatabaseUrl, pathToFileURL(join(tempDir, 'open-story.sqlite')).href);
});

test('DbService validates mysql settings before switching providers', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-db-mysql-validation-'));
  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');

  const db = new DbService();

  assert.throws(
    () =>
      db.updateDatabaseSettings({
        mysql: {
          port: 3307,
        },
      }),
    /MySQL host boş bırakılamaz/,
  );

  const settings = db.getDatabaseSettings();
  assert.equal(settings.activeProvider, 'sqlite');
  assert.equal(settings.mysqlDatabase, null);
});
