import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
const MYSQL_ENV_KEYS = [
  'OPEN_STORY_MYSQL_HOST',
  'OPEN_STORY_MYSQL_PORT',
  'OPEN_STORY_MYSQL_SOCKET_PATH',
  'OPEN_STORY_MYSQL_INSTANCE_CONNECTION_NAME',
  'OPEN_STORY_MYSQL_IP_TYPE',
  'OPEN_STORY_MYSQL_DATABASE',
  'OPEN_STORY_MYSQL_USERNAME',
  'OPEN_STORY_MYSQL_PASSWORD',
  'OPEN_STORY_MYSQL_SSL_MODE',
];

function clearDbEnv() {
  for (const key of [...POSTGRES_ENV_KEYS, ...MYSQL_ENV_KEYS, 'OPEN_STORY_DB_PROVIDER', 'OPEN_STORY_SQLITE_PATH', 'OPEN_STORY_DB_CONFIG_PATH']) {
    delete process.env[key];
  }
}

function configureTempSqliteFallback(prefix) {
  clearDbEnv();

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

test('DbService insertMany stores multiple records with one API call', () => {
  configureTempSqliteFallback('open-story-db-insert-many-');

  const db = new DbService();
  const now = new Date().toISOString();
  const firstId = randomUUID();
  const secondId = randomUUID();

  db.insertMany('placements', [
    {
      id: firstId,
      key: 'home_top',
      name: 'Home Top',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: secondId,
      key: 'home_bottom',
      name: 'Home Bottom',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  assert.deepEqual(
    db.list('placements').map((placement) => placement.id),
    [firstId, secondId],
  );
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
    /Postgres host cannot be empty/,
  );

  const settings = db.getDatabaseSettings();
  assert.equal(settings.activeProvider, 'sqlite');
  assert.equal(settings.postgresDatabase, null);
});

test('DbService validates mysql endpoint settings before switching providers', () => {
  configureTempSqliteFallback('open-story-db-mysql-validation-');

  const db = new DbService();

  assert.throws(
    () =>
      db.updateDatabaseSettings({
        mysql: {
          port: 3306,
          database: 'open_story',
          username: 'open_story_app',
        },
      }),
    /MySQL host, socket path, or instance connection name is required/,
  );

  const settings = db.getDatabaseSettings();
  assert.equal(settings.activeProvider, 'sqlite');
  assert.equal(settings.mysqlDatabase, null);
});

test('DbService rejects empty database provider switching', () => {
  configureTempSqliteFallback('open-story-db-empty-postgres-');

  const db = new DbService();

  assert.throws(() => db.updateDatabaseSettings({}), /Postgres connection details are required/);
});

test('DbService test connection requires postgres settings', () => {
  configureTempSqliteFallback('open-story-db-test-postgres-required-');

  const db = new DbService();
  const result = db.testDatabaseConnection({});

  assert.equal(result.ok, false);
  assert.equal(result.provider, null);
  assert.match(result.message, /Postgres connection details/);
});

test('DbService resolves postgres settings from environment before config file', () => {
  configureTempSqliteFallback('open-story-db-env-priority-');
  writeFileSync(
    process.env.OPEN_STORY_DB_CONFIG_PATH,
    JSON.stringify(
      {
        version: 3,
        activeProvider: 'postgres',
        localDatabaseUrl: `file://${process.env.OPEN_STORY_SQLITE_PATH}`,
        externalPostgresDatabase: {
          host: 'config-db.internal',
          port: 5432,
          database: 'config_db',
          username: 'config_user',
          password: 'config_secret',
          sslMode: 'require',
        },
        updatedAt: '2026-05-07T08:00:00.000Z',
      },
      null,
      2,
    ),
  );

  process.env.OPEN_STORY_POSTGRES_HOST = 'env-db.internal';
  process.env.OPEN_STORY_POSTGRES_PORT = '6543';
  process.env.OPEN_STORY_POSTGRES_DATABASE = 'env_db';
  process.env.OPEN_STORY_POSTGRES_USERNAME = 'env_user';
  process.env.OPEN_STORY_POSTGRES_PASSWORD = 'env_secret';
  process.env.OPEN_STORY_POSTGRES_SSL_MODE = 'disable';

  const settings = new DbService().getDatabaseSettings();

  assert.equal(settings.activeProvider, 'postgres');
  assert.equal(settings.postgresDatabase?.host, 'env-db.internal');
  assert.equal(settings.postgresDatabase?.port, 6543);
  assert.equal(settings.postgresDatabase?.database, 'env_db');
  assert.equal(settings.postgresDatabase?.username, 'env_user');
  assert.equal(settings.postgresDatabase?.sslMode, 'disable');
  assert.match(settings.activeDatabaseUrl, /env-db\.internal:6543\/env_db\?sslmode=disable/);
});

test('DbService falls back to config file postgres settings when environment is absent', () => {
  configureTempSqliteFallback('open-story-db-config-fallback-');
  writeFileSync(
    process.env.OPEN_STORY_DB_CONFIG_PATH,
    JSON.stringify(
      {
        version: 3,
        activeProvider: 'postgres',
        localDatabaseUrl: `file://${process.env.OPEN_STORY_SQLITE_PATH}`,
        externalPostgresDatabase: {
          host: 'config-db.internal',
          port: 5432,
          database: 'config_db',
          username: 'config_user',
          password: 'config_secret',
          sslMode: 'require',
        },
        updatedAt: '2026-05-07T08:00:00.000Z',
      },
      null,
      2,
    ),
  );

  const settings = new DbService().getDatabaseSettings();

  assert.equal(settings.activeProvider, 'postgres');
  assert.equal(settings.postgresDatabase?.host, 'config-db.internal');
  assert.equal(settings.postgresDatabase?.port, 5432);
  assert.equal(settings.postgresDatabase?.database, 'config_db');
  assert.equal(settings.postgresDatabase?.username, 'config_user');
  assert.equal(settings.postgresDatabase?.sslMode, 'require');
});

test('DbService requires relational database configuration in production runtime', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  configureTempSqliteFallback('open-story-db-production-postgres-required-');
  process.env.NODE_ENV = 'production';

  try {
    const db = new DbService();
    assert.throws(() => db.getDatabaseSettings(), /A Postgres or MySQL connection is required in production runtime/);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test('DbService resolves mysql Cloud SQL socket settings from environment', () => {
  configureTempSqliteFallback('open-story-db-mysql-env-');
  process.env.OPEN_STORY_DB_PROVIDER = 'mysql';
  process.env.OPEN_STORY_MYSQL_SOCKET_PATH = '/cloudsql/project:region:instance';
  process.env.OPEN_STORY_MYSQL_DATABASE = 'open_story';
  process.env.OPEN_STORY_MYSQL_USERNAME = 'open_story_app';
  process.env.OPEN_STORY_MYSQL_PASSWORD = 'env_secret';
  process.env.OPEN_STORY_MYSQL_SSL_MODE = 'disable';

  const settings = new DbService().getDatabaseSettings();

  assert.equal(settings.activeProvider, 'mysql');
  assert.equal(settings.mysqlDatabase?.host, null);
  assert.equal(settings.mysqlDatabase?.port, 3306);
  assert.equal(settings.mysqlDatabase?.socketPath, '/cloudsql/project:region:instance');
  assert.equal(settings.mysqlDatabase?.instanceConnectionName, null);
  assert.equal(settings.mysqlDatabase?.ipType, 'PUBLIC');
  assert.equal(settings.mysqlDatabase?.database, 'open_story');
  assert.equal(settings.mysqlDatabase?.username, 'open_story_app');
  assert.equal(settings.mysqlDatabase?.sslMode, 'disable');
  assert.equal(settings.mysqlDatabase?.configuredFromEnvironment, true);
  assert.equal(
    settings.activeDatabaseUrl,
    'mysql://open_story_app@unix(/cloudsql/project:region:instance)/open_story?sslmode=disable',
  );
});

test('DbService resolves mysql Cloud SQL Connector settings from environment', () => {
  configureTempSqliteFallback('open-story-db-mysql-connector-env-');
  process.env.OPEN_STORY_DB_PROVIDER = 'mysql';
  process.env.OPEN_STORY_MYSQL_INSTANCE_CONNECTION_NAME = 'project:region:instance';
  process.env.OPEN_STORY_MYSQL_IP_TYPE = 'PRIVATE';
  process.env.OPEN_STORY_MYSQL_DATABASE = 'open_story';
  process.env.OPEN_STORY_MYSQL_USERNAME = 'open_story_app';
  process.env.OPEN_STORY_MYSQL_PASSWORD = 'env_secret';

  const settings = new DbService().getDatabaseSettings();

  assert.equal(settings.activeProvider, 'mysql');
  assert.equal(settings.mysqlDatabase?.host, null);
  assert.equal(settings.mysqlDatabase?.socketPath, null);
  assert.equal(settings.mysqlDatabase?.instanceConnectionName, 'project:region:instance');
  assert.equal(settings.mysqlDatabase?.ipType, 'PRIVATE');
  assert.equal(
    settings.activeDatabaseUrl,
    'mysql://open_story_app@cloudsql(project:region:instance;iptype=PRIVATE)/open_story?sslmode=disable',
  );
});
