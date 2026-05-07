import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { storyPlatformTableNames } from '../../contracts/src/persistence.ts';
import { DbService } from './db.service.ts';

const POSTGRES_ENV_KEYS = [
  'OPEN_STORY_POSTGRES_HOST',
  'OPEN_STORY_POSTGRES_PORT',
  'OPEN_STORY_POSTGRES_DATABASE',
  'OPEN_STORY_POSTGRES_USERNAME',
  'OPEN_STORY_POSTGRES_PASSWORD',
  'OPEN_STORY_POSTGRES_SSL_MODE',
];

function configureTempSqliteFallback(prefix) {
  for (const key of POSTGRES_ENV_KEYS) {
    delete process.env[key];
  }

  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');
}

test('DbService tracks counts for canonical story platform tables', () => {
  configureTempSqliteFallback('open-story-db-phase1-');

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

test('DbService validates postgres settings before switching providers', () => {
  configureTempSqliteFallback('open-story-db-postgres-validation-');

  const db = new DbService();

  assert.throws(
    () =>
      db.updateDatabaseSettings({
        postgres: {
          port: 5432,
        },
      }),
    /Postgres host boş bırakılamaz/,
  );

  const settings = db.getDatabaseSettings();
  assert.equal(settings.activeProvider, 'sqlite');
  assert.equal(settings.postgresDatabase, null);
});

test('DbService rejects empty database provider switching', () => {
  configureTempSqliteFallback('open-story-db-empty-postgres-');

  const db = new DbService();

  assert.throws(() => db.updateDatabaseSettings({}), /Postgres bağlantı bilgileri gereklidir/);
});

test('DbService test connection requires postgres settings', () => {
  configureTempSqliteFallback('open-story-db-test-postgres-required-');

  const db = new DbService();
  const result = db.testDatabaseConnection({});

  assert.equal(result.ok, false);
  assert.equal(result.provider, null);
  assert.match(result.message, /Postgres bağlantı bilgisi/);
});

test('DbService requires postgres configuration in production runtime', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  configureTempSqliteFallback('open-story-db-production-postgres-required-');
  process.env.NODE_ENV = 'production';

  try {
    const db = new DbService();
    assert.throws(() => db.getDatabaseSettings(), /Production runtime için Postgres bağlantısı gereklidir/);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
