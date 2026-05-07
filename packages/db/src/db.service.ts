import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, normalize, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storyPlatformTableNames, type StoryPlatformTableName } from '../../contracts/src/persistence.ts';
import {
  initializeRelationalPostgresDatabase,
  isRelationalPostgresMode,
  relationalPostgresCountRows,
  relationalPostgresDeleteRecord,
  relationalPostgresInsertRecord,
  relationalPostgresListAllRecords,
  relationalPostgresListPayloads,
  relationalPostgresReplaceAllRecords,
} from './relational-postgres-store.ts';

const require = createRequire(import.meta.url);

export type TableName = StoryPlatformTableName;
export type DatabaseProvider = 'sqlite' | 'mysql' | 'postgres';
export type PostgresSslMode = 'disable' | 'require';

type DbRecord = {
  id: string;
  [key: string]: unknown;
};

type MysqlExternalDatabaseConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

type PostgresExternalDatabaseConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode: PostgresSslMode;
};

type BootstrapConfig = {
  version: 3;
  activeProvider: DatabaseProvider;
  localDatabaseUrl: string;
  externalDatabaseUrl: string | null;
  externalMysqlDatabase: MysqlExternalDatabaseConfig | null;
  externalPostgresDatabase: PostgresExternalDatabaseConfig | null;
  migratedAt: string | null;
  updatedAt: string;
};

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Array<Record<string, unknown>>;
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

type SqliteDatabaseTarget = {
  provider: 'sqlite';
  key: string;
  url: string;
  path: string;
};

type MysqlDatabaseTarget = {
  provider: 'mysql';
  key: string;
  url: string;
  config: MysqlExternalDatabaseConfig;
};

type PostgresDatabaseTarget = {
  provider: 'postgres';
  key: string;
  url: string;
  config: PostgresExternalDatabaseConfig;
};

type DatabaseTarget = SqliteDatabaseTarget | MysqlDatabaseTarget | PostgresDatabaseTarget;
type SqlDatabaseTarget = MysqlDatabaseTarget | PostgresDatabaseTarget;

type ActiveDatabaseConnection =
  | {
      target: SqliteDatabaseTarget;
      sqlite: SqliteDatabase;
    }
  | {
      target: MysqlDatabaseTarget;
      sqlite: null;
    }
  | {
      target: PostgresDatabaseTarget;
      sqlite: null;
    };

type StoredRecord = {
  tableName: string;
  id: string;
  payload: string;
  updatedAt: string;
};

type SqlReadCache = {
  targetKey: string;
  expiresAtMs: number;
  recordsByTable: Map<TableName, StoredRecord[]>;
  tableCounts: Record<string, number>;
};

type MysqlStatement = {
  sql: string;
  params?: unknown[];
};

type PostgresStatement = {
  sql: string;
  params?: unknown[];
};

export type MysqlDatabaseSettingsSnapshot = {
  host: string;
  port: number;
  database: string;
  username: string;
  passwordConfigured: boolean;
};

export type PostgresDatabaseSettingsSnapshot = {
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode: PostgresSslMode;
  passwordConfigured: boolean;
};

export type UpdateMysqlDatabaseSettingsInput = {
  host?: string | null;
  port?: string | number | null;
  database?: string | null;
  username?: string | null;
  password?: string | null;
};

export type UpdatePostgresDatabaseSettingsInput = {
  host?: string | null;
  port?: string | number | null;
  database?: string | null;
  username?: string | null;
  password?: string | null;
  sslMode?: PostgresSslMode | null;
};

export interface UpdateDatabaseSettingsInput {
  externalDatabaseUrl?: string | null;
  mysql?: UpdateMysqlDatabaseSettingsInput | null;
  postgres?: UpdatePostgresDatabaseSettingsInput | null;
}

export interface TestDatabaseConnectionInput extends UpdateDatabaseSettingsInput {}

export interface DatabaseConnectionTestResult {
  ok: boolean;
  provider: DatabaseProvider | null;
  message: string;
  resolvedDatabaseUrl: string | null;
}

export interface DatabaseSettingsSnapshot {
  defaultSqliteUrl: string;
  activeProvider: DatabaseProvider;
  activeDatabaseUrl: string;
  externalDatabaseUrl: string | null;
  mysqlDatabase: MysqlDatabaseSettingsSnapshot | null;
  postgresDatabase: PostgresDatabaseSettingsSnapshot | null;
  isUsingExternalDatabase: boolean;
  migratedAt: string | null;
  tableCounts: Record<string, number>;
}

const TABLE_NAMES: TableName[] = [...storyPlatformTableNames];

const SQLITE_FILENAME = 'open-story.sqlite';
const CONFIG_FILENAME = 'database-config.json';
const SQLITE_PATH_ENV = 'OPEN_STORY_SQLITE_PATH';
const CONFIG_PATH_ENV = 'OPEN_STORY_DB_CONFIG_PATH';
const MYSQL_DEFAULT_PORT = 3306;
const POSTGRES_DEFAULT_PORT = 5432;
const MYSQL_RUNNER_PATH = fileURLToPath(new URL('./mysql-query-runner.mjs', import.meta.url));
const POSTGRES_RUNNER_PATH = fileURLToPath(new URL('./postgres-query-runner.mjs', import.meta.url));
const MYSQL_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const POSTGRES_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const SQL_READ_CACHE_TTL_ENV = 'OPEN_STORY_DB_READ_CACHE_TTL_MS';
const DEFAULT_SQL_READ_CACHE_TTL_MS = 5_000;

const STORAGE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS records (
    table_name TEXT NOT NULL,
    id TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (table_name, id)
  );

  CREATE INDEX IF NOT EXISTS idx_records_table_name
    ON records (table_name, updated_at DESC);
`;

const MYSQL_STORAGE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS records (
    sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    table_name VARCHAR(128) NOT NULL,
    id VARCHAR(191) NOT NULL,
    payload LONGTEXT NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    PRIMARY KEY (table_name, id),
    UNIQUE KEY idx_records_sequence_id (sequence_id),
    KEY idx_records_table_name (table_name, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const POSTGRES_STORAGE_SCHEMA_STATEMENTS: PostgresStatement[] = [
  {
    sql: `
      CREATE TABLE IF NOT EXISTS records (
        sequence_id BIGSERIAL,
        table_name VARCHAR(128) NOT NULL,
        id VARCHAR(191) NOT NULL,
        payload TEXT NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (table_name, id)
      )
    `,
  },
  {
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_records_sequence_id ON records (sequence_id)',
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_records_table_name ON records (table_name, updated_at DESC)',
  },
];

function getSqliteDriver(): { DatabaseSync: new (location: string) => SqliteDatabase } {
  return require('node:sqlite') as { DatabaseSync: new (location: string) => SqliteDatabase };
}

function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    if (existsSync(resolve(currentDir, 'apps/api')) && existsSync(resolve(currentDir, 'apps/admin-web'))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function resolveDefaultDataDir(): string {
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  if (workspaceRoot) {
    return resolve(workspaceRoot, 'apps/api/data');
  }

  const repoApiDir = resolve(process.cwd(), 'apps/api');
  if (existsSync(repoApiDir)) {
    return resolve(repoApiDir, 'data');
  }

  return resolve(process.cwd(), 'data');
}

function ensureParentDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function resolveSqlitePath(input: string): string {
  const normalizedInput = input.trim();
  if (!normalizedInput) {
    throw new Error('Database URL veya path boş bırakılamaz.');
  }

  if (normalizedInput.startsWith('file://')) {
    return normalize(fileURLToPath(normalizedInput));
  }

  if (normalizedInput.startsWith('sqlite://')) {
    const value = normalizedInput.slice('sqlite://'.length);
    if (!value) {
      throw new Error('sqlite URL geçerli bir dosya yolu içermelidir.');
    }

    return normalize(isAbsolute(value) ? value : resolve(process.cwd(), value));
  }

  if (/^[a-zA-Z]+:\/\//.test(normalizedInput)) {
    throw new Error('Bu sürümde sqlite için sadece sqlite/file tabanlı database URL formatları desteklenir.');
  }

  return normalize(isAbsolute(normalizedInput) ? normalizedInput : resolve(process.cwd(), normalizedInput));
}

function toFileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

function resolveLocalDatabasePath(): string {
  const configuredPath = process.env[SQLITE_PATH_ENV]?.trim();
  if (configuredPath) {
    return resolveSqlitePath(configuredPath);
  }

  return resolve(resolveDefaultDataDir(), SQLITE_FILENAME);
}

function resolveConfigPath(): string {
  const configuredPath = process.env[CONFIG_PATH_ENV]?.trim();
  if (configuredPath) {
    return resolveSqlitePath(configuredPath);
  }

  return resolve(resolveDefaultDataDir(), CONFIG_FILENAME);
}

function createDefaultConfig(): BootstrapConfig {
  const now = new Date().toISOString();

  return {
    version: 3,
    activeProvider: 'sqlite',
    localDatabaseUrl: toFileUrl(resolveLocalDatabasePath()),
    externalDatabaseUrl: null,
    externalMysqlDatabase: null,
    externalPostgresDatabase: null,
    migratedAt: null,
    updatedAt: now,
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseMysqlDatabaseConfig(value: unknown): MysqlExternalDatabaseConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as Partial<MysqlExternalDatabaseConfig>;
  const host = readString(parsed.host);
  const database = readString(parsed.database);
  const username = readString(parsed.username);
  const port = Number(parsed.port);

  if (!host || !database || !username || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return {
    host,
    port,
    database,
    username,
    password: typeof parsed.password === 'string' ? parsed.password : '',
  };
}

function parsePostgresSslMode(value: unknown): PostgresSslMode {
  return value === 'disable' ? 'disable' : 'require';
}

function parsePostgresDatabaseConfig(value: unknown): PostgresExternalDatabaseConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as Partial<PostgresExternalDatabaseConfig>;
  const host = readString(parsed.host);
  const database = readString(parsed.database);
  const username = readString(parsed.username);
  const port = Number(parsed.port);

  if (!host || !database || !username || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return {
    host,
    port,
    database,
    username,
    password: typeof parsed.password === 'string' ? parsed.password : '',
    sslMode: parsePostgresSslMode(parsed.sslMode),
  };
}

function parseConfig(rawValue: string): BootstrapConfig {
  const parsed = JSON.parse(rawValue) as Partial<BootstrapConfig>;
  const defaults = createDefaultConfig();
  const externalMysqlDatabase = parseMysqlDatabaseConfig(parsed.externalMysqlDatabase);
  const externalPostgresDatabase = parsePostgresDatabaseConfig(parsed.externalPostgresDatabase);
  const activeProvider: DatabaseProvider =
    parsed.activeProvider === 'postgres' && externalPostgresDatabase
      ? 'postgres'
      : parsed.activeProvider === 'mysql' && externalMysqlDatabase
        ? 'mysql'
        : 'sqlite';

  return {
    version: 3,
    activeProvider,
    localDatabaseUrl:
      typeof parsed.localDatabaseUrl === 'string' && parsed.localDatabaseUrl.trim()
        ? toFileUrl(resolveSqlitePath(parsed.localDatabaseUrl))
        : defaults.localDatabaseUrl,
    externalDatabaseUrl:
      typeof parsed.externalDatabaseUrl === 'string' && parsed.externalDatabaseUrl.trim()
        ? toFileUrl(resolveSqlitePath(parsed.externalDatabaseUrl))
        : null,
    externalMysqlDatabase,
    externalPostgresDatabase,
    migratedAt: typeof parsed.migratedAt === 'string' ? parsed.migratedAt : null,
    updatedAt:
      typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim() ? parsed.updatedAt : defaults.updatedAt,
  };
}

function readBootstrapConfig(): BootstrapConfig {
  const configPath = resolveConfigPath();
  ensureParentDirectory(configPath);

  if (!existsSync(configPath)) {
    const defaults = createDefaultConfig();
    writeFileSync(configPath, JSON.stringify(defaults, null, 2));
    return defaults;
  }

  return parseConfig(readFileSync(configPath, 'utf8'));
}

function writeBootstrapConfig(config: BootstrapConfig): void {
  const configPath = resolveConfigPath();
  ensureParentDirectory(configPath);
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function openSqliteDatabase(filePath: string): SqliteDatabase {
  ensureParentDirectory(filePath);
  const { DatabaseSync } = getSqliteDriver();
  const database = new DatabaseSync(filePath);
  database.exec(STORAGE_SCHEMA);
  return database;
}

function ensureSqliteFile(filePath: string): void {
  const database = openSqliteDatabase(filePath);
  database.close();
}

function testSqliteConnection(filePath: string): void {
  ensureParentDirectory(filePath);
  const { DatabaseSync } = getSqliteDriver();
  const database = new DatabaseSync(filePath);

  try {
    database.prepare('SELECT 1 AS ok').get();
  } finally {
    database.close();
  }
}

function toMysqlDisplayUrl(config: MysqlExternalDatabaseConfig): string {
  const username = encodeURIComponent(config.username);
  const database = encodeURIComponent(config.database);
  return `mysql://${username}@${config.host}:${config.port}/${database}`;
}

function toPostgresDisplayUrl(config: PostgresExternalDatabaseConfig): string {
  const username = encodeURIComponent(config.username);
  const database = encodeURIComponent(config.database);
  return `postgresql://${username}@${config.host}:${config.port}/${database}?sslmode=${config.sslMode}`;
}

function toMysqlConnectionKey(config: MysqlExternalDatabaseConfig): string {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
  });
}

function toPostgresConnectionKey(config: PostgresExternalDatabaseConfig): string {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    sslMode: config.sslMode,
  });
}

function getSqliteTarget(databaseUrl: string): SqliteDatabaseTarget {
  const path = resolveSqlitePath(databaseUrl);

  return {
    provider: 'sqlite',
    key: `sqlite:${path}`,
    url: toFileUrl(path),
    path,
  };
}

function getActiveDatabaseTarget(config: BootstrapConfig): DatabaseTarget {
  if (config.activeProvider === 'postgres' && config.externalPostgresDatabase) {
    return {
      provider: 'postgres',
      key: `postgres:${toPostgresConnectionKey(config.externalPostgresDatabase)}`,
      url: toPostgresDisplayUrl(config.externalPostgresDatabase),
      config: config.externalPostgresDatabase,
    };
  }

  if (config.activeProvider === 'mysql' && config.externalMysqlDatabase) {
    return {
      provider: 'mysql',
      key: `mysql:${toMysqlConnectionKey(config.externalMysqlDatabase)}`,
      url: toMysqlDisplayUrl(config.externalMysqlDatabase),
      config: config.externalMysqlDatabase,
    };
  }

  return getSqliteTarget(config.externalDatabaseUrl ?? config.localDatabaseUrl);
}

function targetsEqual(left: DatabaseTarget, right: DatabaseTarget): boolean {
  return left.key === right.key;
}

function normalizeExternalDatabaseUrl(externalDatabaseUrl: string | null | undefined, localDatabaseUrl: string): string | null {
  const nextValue = externalDatabaseUrl?.trim();
  if (!nextValue) {
    return null;
  }

  const resolvedExternalPath = resolveSqlitePath(nextValue);
  const localPath = resolveSqlitePath(localDatabaseUrl);
  if (resolvedExternalPath === localPath) {
    return null;
  }

  return toFileUrl(resolvedExternalPath);
}

function hasMysqlSettingsInput(input: UpdateMysqlDatabaseSettingsInput | null | undefined): input is UpdateMysqlDatabaseSettingsInput {
  if (!input) {
    return false;
  }

  return [input.host, input.port, input.database, input.username, input.password].some((value) =>
    String(value ?? '').trim().length > 0,
  );
}

function hasPostgresSettingsInput(
  input: UpdatePostgresDatabaseSettingsInput | null | undefined,
): input is UpdatePostgresDatabaseSettingsInput {
  if (!input) {
    return false;
  }

  return [input.host, input.port, input.database, input.username, input.password, input.sslMode].some((value) =>
    String(value ?? '').trim().length > 0,
  );
}

function normalizeMysqlPort(value: string | number | null | undefined): number {
  const normalizedValue =
    typeof value === 'string'
      ? Number(value.trim() || MYSQL_DEFAULT_PORT)
      : value === null || value === undefined
        ? MYSQL_DEFAULT_PORT
        : Number(value);
  if (!Number.isInteger(normalizedValue) || normalizedValue < 1 || normalizedValue > 65535) {
    throw new Error('MySQL port 1 ile 65535 arasında bir tam sayı olmalıdır.');
  }

  return normalizedValue;
}

function normalizePostgresPort(value: string | number | null | undefined): number {
  const normalizedValue =
    typeof value === 'string'
      ? Number(value.trim() || POSTGRES_DEFAULT_PORT)
      : value === null || value === undefined
        ? POSTGRES_DEFAULT_PORT
        : Number(value);
  if (!Number.isInteger(normalizedValue) || normalizedValue < 1 || normalizedValue > 65535) {
    throw new Error('Postgres port 1 ile 65535 arasında bir tam sayı olmalıdır.');
  }

  return normalizedValue;
}

function normalizePostgresSslMode(value: PostgresSslMode | null | undefined): PostgresSslMode {
  return value === 'disable' ? 'disable' : 'require';
}

function normalizeRequiredMysqlField(value: string | null | undefined, label: string, maxLength: number): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new Error(`${label} boş bırakılamaz.`);
  }

  if (normalizedValue.length > maxLength) {
    throw new Error(`${label} en fazla ${maxLength} karakter olabilir.`);
  }

  return normalizedValue;
}

function normalizeRequiredPostgresField(value: string | null | undefined, label: string, maxLength: number): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new Error(`${label} boş bırakılamaz.`);
  }

  if (normalizedValue.length > maxLength) {
    throw new Error(`${label} en fazla ${maxLength} karakter olabilir.`);
  }

  return normalizedValue;
}

function mysqlIdentityMatches(left: MysqlExternalDatabaseConfig, right: MysqlExternalDatabaseConfig): boolean {
  return (
    left.host === right.host &&
    left.port === right.port &&
    left.database === right.database &&
    left.username === right.username
  );
}

function postgresIdentityMatches(left: PostgresExternalDatabaseConfig, right: PostgresExternalDatabaseConfig): boolean {
  return (
    left.host === right.host &&
    left.port === right.port &&
    left.database === right.database &&
    left.username === right.username &&
    left.sslMode === right.sslMode
  );
}

function normalizeMysqlDatabaseSettings(
  input: UpdateMysqlDatabaseSettingsInput | null | undefined,
  currentConfig: BootstrapConfig,
): MysqlExternalDatabaseConfig | null {
  if (!hasMysqlSettingsInput(input)) {
    return null;
  }

  const nextWithoutPassword: MysqlExternalDatabaseConfig = {
    host: normalizeRequiredMysqlField(input.host, 'MySQL host', 255),
    port: normalizeMysqlPort(input.port),
    database: normalizeRequiredMysqlField(input.database, 'MySQL database adı', 128),
    username: normalizeRequiredMysqlField(input.username, 'MySQL kullanıcı adı', 128),
    password: '',
  };

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length > 1024) {
    throw new Error('MySQL password en fazla 1024 karakter olabilir.');
  }

  return {
    ...nextWithoutPassword,
    password:
      password || (currentConfig.externalMysqlDatabase && mysqlIdentityMatches(nextWithoutPassword, currentConfig.externalMysqlDatabase)
        ? currentConfig.externalMysqlDatabase.password
        : ''),
  };
}

function normalizePostgresDatabaseSettings(
  input: UpdatePostgresDatabaseSettingsInput | null | undefined,
  currentConfig: BootstrapConfig,
): PostgresExternalDatabaseConfig | null {
  if (!hasPostgresSettingsInput(input)) {
    return null;
  }

  const nextWithoutPassword: PostgresExternalDatabaseConfig = {
    host: normalizeRequiredPostgresField(input.host, 'Postgres host', 255),
    port: normalizePostgresPort(input.port),
    database: normalizeRequiredPostgresField(input.database, 'Postgres database adı', 128),
    username: normalizeRequiredPostgresField(input.username, 'Postgres kullanıcı adı', 128),
    password: '',
    sslMode: normalizePostgresSslMode(input.sslMode),
  };

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length > 1024) {
    throw new Error('Postgres password en fazla 1024 karakter olabilir.');
  }

  return {
    ...nextWithoutPassword,
    password:
      password ||
      (currentConfig.externalPostgresDatabase &&
      postgresIdentityMatches(nextWithoutPassword, currentConfig.externalPostgresDatabase)
        ? currentConfig.externalPostgresDatabase.password
        : ''),
  };
}

function normalizeUpdateInput(
  input: string | UpdateDatabaseSettingsInput | null | undefined,
): UpdateDatabaseSettingsInput {
  if (typeof input === 'string' || input === null || input === undefined) {
    return {
      externalDatabaseUrl: input ?? null,
      mysql: null,
    };
  }

  return input;
}

function toMysqlSnapshot(config: MysqlExternalDatabaseConfig | null): MysqlDatabaseSettingsSnapshot | null {
  if (!config) {
    return null;
  }

  return {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    passwordConfigured: config.password.length > 0,
  };
}

function toPostgresSnapshot(config: PostgresExternalDatabaseConfig | null): PostgresDatabaseSettingsSnapshot | null {
  if (!config) {
    return null;
  }

  return {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    sslMode: config.sslMode,
    passwordConfigured: config.password.length > 0,
  };
}

function runMysqlStatements(config: MysqlExternalDatabaseConfig, statements: MysqlStatement[]): unknown[] {
  const result = spawnSync(process.execPath, [MYSQL_RUNNER_PATH], {
    input: JSON.stringify({ config, statements }),
    encoding: 'utf8',
    maxBuffer: MYSQL_MAX_BUFFER_BYTES,
  });

  if (result.error) {
    throw new Error(`MySQL işlemi başlatılamadı: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `exit code ${result.status}`).trim();
    throw new Error(`MySQL bağlantısı veya sorgusu başarısız: ${message}`);
  }

  try {
    const parsed = JSON.parse(result.stdout || '{}') as { results?: unknown[] };
    return parsed.results ?? [];
  } catch (error) {
    throw new Error(
      error instanceof Error ? `MySQL sorgu sonucu okunamadı: ${error.message}` : 'MySQL sorgu sonucu okunamadı.',
    );
  }
}

function initializeMysqlDatabase(config: MysqlExternalDatabaseConfig): void {
  runMysqlStatements(config, [{ sql: MYSQL_STORAGE_SCHEMA }]);
}

function testMysqlConnection(config: MysqlExternalDatabaseConfig): void {
  runMysqlStatements(config, [{ sql: 'SELECT 1 AS ok' }]);
}

function mysqlRows(result: unknown): Array<Record<string, unknown>> {
  return Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
}

function mysqlListPayloads(config: MysqlExternalDatabaseConfig, table: TableName): Array<Record<string, unknown>> {
  const [rows] = runMysqlStatements(config, [
    {
      sql: 'SELECT id, payload, updated_at AS updatedAt FROM records WHERE table_name = ? ORDER BY sequence_id ASC',
      params: [table],
    },
  ]);

  return mysqlRows(rows);
}

function mysqlFindPayload(config: MysqlExternalDatabaseConfig, table: TableName, id: string): Record<string, unknown> | undefined {
  const [rows] = runMysqlStatements(config, [
    {
      sql: 'SELECT payload FROM records WHERE table_name = ? AND id = ? LIMIT 1',
      params: [table, id],
    },
  ]);

  return mysqlRows(rows)[0];
}

function mysqlInsertRecord(config: MysqlExternalDatabaseConfig, table: TableName, row: DbRecord, updatedAt: string): void {
  runMysqlStatements(config, [
    {
      sql: `
        INSERT INTO records (table_name, id, payload, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          payload = VALUES(payload),
          updated_at = VALUES(updated_at)
      `,
      params: [table, row.id, JSON.stringify(row), updatedAt],
    },
  ]);
}

function mysqlDeleteRecord(config: MysqlExternalDatabaseConfig, table: TableName, id: string): boolean {
  const [result] = runMysqlStatements(config, [
    {
      sql: 'DELETE FROM records WHERE table_name = ? AND id = ?',
      params: [table, id],
    },
  ]);
  const header = result as { affectedRows?: number | string } | undefined;

  return Number(header?.affectedRows ?? 0) > 0;
}

function mysqlCountRows(config: MysqlExternalDatabaseConfig): Record<string, number> {
  const [rows] = runMysqlStatements(config, [
    {
      sql: 'SELECT table_name AS tableName, COUNT(*) AS count FROM records GROUP BY table_name',
    },
  ]);
  const counts = Object.fromEntries(TABLE_NAMES.map((table) => [table, 0]));

  for (const row of mysqlRows(rows)) {
    const tableName = String(row.tableName ?? '');
    if (tableName in counts) {
      counts[tableName] = Number(row.count ?? 0);
    }
  }

  return counts;
}

function mysqlListAllRecords(config: MysqlExternalDatabaseConfig): StoredRecord[] {
  const [rows] = runMysqlStatements(config, [
    {
      sql: `
        SELECT table_name AS tableName, id, payload, updated_at AS updatedAt
        FROM records
        ORDER BY sequence_id ASC
      `,
    },
  ]);

  return mysqlRows(rows).map((row) => ({
    tableName: String(row.tableName),
    id: String(row.id),
    payload: String(row.payload),
    updatedAt: String(row.updatedAt),
  }));
}

function mysqlReplaceAllRecords(config: MysqlExternalDatabaseConfig, records: StoredRecord[]): void {
  runMysqlStatements(config, [
    { sql: 'START TRANSACTION' },
    { sql: 'DELETE FROM records' },
    ...records.map((record) => ({
      sql: `
        INSERT INTO records (table_name, id, payload, updated_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          payload = VALUES(payload),
          updated_at = VALUES(updated_at)
      `,
      params: [record.tableName, record.id, record.payload, record.updatedAt],
    })),
    { sql: 'COMMIT' },
  ]);
}

function runPostgresStatements(config: PostgresExternalDatabaseConfig, statements: PostgresStatement[]): unknown[] {
  const result = spawnSync(process.execPath, [POSTGRES_RUNNER_PATH], {
    input: JSON.stringify({ config, statements }),
    encoding: 'utf8',
    maxBuffer: POSTGRES_MAX_BUFFER_BYTES,
  });

  if (result.error) {
    throw new Error(`Postgres işlemi başlatılamadı: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `exit code ${result.status}`).trim();
    throw new Error(`Postgres bağlantısı veya sorgusu başarısız: ${message}`);
  }

  try {
    const parsed = JSON.parse(result.stdout || '{}') as { results?: unknown[] };
    return parsed.results ?? [];
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Postgres sorgu sonucu okunamadı: ${error.message}` : 'Postgres sorgu sonucu okunamadı.',
    );
  }
}

function initializePostgresDatabase(config: PostgresExternalDatabaseConfig): void {
  runPostgresStatements(config, POSTGRES_STORAGE_SCHEMA_STATEMENTS);
}

function testPostgresConnection(config: PostgresExternalDatabaseConfig): void {
  runPostgresStatements(config, [{ sql: 'SELECT 1 AS ok' }]);
}

function postgresRows(result: unknown): Array<Record<string, unknown>> {
  return Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
}

function postgresListPayloads(config: PostgresExternalDatabaseConfig, table: TableName): Array<Record<string, unknown>> {
  const [rows] = runPostgresStatements(config, [
    {
      sql: 'SELECT id, payload, updated_at AS "updatedAt" FROM records WHERE table_name = $1 ORDER BY sequence_id ASC',
      params: [table],
    },
  ]);

  return postgresRows(rows);
}

function postgresFindPayload(
  config: PostgresExternalDatabaseConfig,
  table: TableName,
  id: string,
): Record<string, unknown> | undefined {
  const [rows] = runPostgresStatements(config, [
    {
      sql: 'SELECT payload FROM records WHERE table_name = $1 AND id = $2 LIMIT 1',
      params: [table, id],
    },
  ]);

  return postgresRows(rows)[0];
}

function postgresInsertRecord(
  config: PostgresExternalDatabaseConfig,
  table: TableName,
  row: DbRecord,
  updatedAt: string,
): void {
  runPostgresStatements(config, [
    {
      sql: `
        INSERT INTO records (table_name, id, payload, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (table_name, id) DO UPDATE
        SET payload = EXCLUDED.payload,
            updated_at = EXCLUDED.updated_at
      `,
      params: [table, row.id, JSON.stringify(row), updatedAt],
    },
  ]);
}

function postgresDeleteRecord(config: PostgresExternalDatabaseConfig, table: TableName, id: string): boolean {
  const [result] = runPostgresStatements(config, [
    {
      sql: 'DELETE FROM records WHERE table_name = $1 AND id = $2',
      params: [table, id],
    },
  ]);
  const header = result as { rowCount?: number | string } | undefined;

  return Number(header?.rowCount ?? 0) > 0;
}

function postgresCountRows(config: PostgresExternalDatabaseConfig): Record<string, number> {
  const [rows] = runPostgresStatements(config, [
    {
      sql: 'SELECT table_name AS "tableName", COUNT(*) AS count FROM records GROUP BY table_name',
    },
  ]);
  const counts = Object.fromEntries(TABLE_NAMES.map((table) => [table, 0]));

  for (const row of postgresRows(rows)) {
    const tableName = String(row.tableName ?? '');
    if (tableName in counts) {
      counts[tableName] = Number(row.count ?? 0);
    }
  }

  return counts;
}

function postgresListAllRecords(config: PostgresExternalDatabaseConfig): StoredRecord[] {
  const [rows] = runPostgresStatements(config, [
    {
      sql: `
        SELECT table_name AS "tableName", id, payload, updated_at AS "updatedAt"
        FROM records
        ORDER BY sequence_id ASC
      `,
    },
  ]);

  return postgresRows(rows).map((row) => ({
    tableName: String(row.tableName),
    id: String(row.id),
    payload: String(row.payload),
    updatedAt: String(row.updatedAt),
  }));
}

function postgresReplaceAllRecords(config: PostgresExternalDatabaseConfig, records: StoredRecord[]): void {
  runPostgresStatements(config, [
    { sql: 'BEGIN' },
    { sql: 'DELETE FROM records' },
    ...records.map((record) => ({
      sql: `
        INSERT INTO records (table_name, id, payload, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (table_name, id) DO UPDATE
        SET payload = EXCLUDED.payload,
            updated_at = EXCLUDED.updated_at
      `,
      params: [record.tableName, record.id, record.payload, record.updatedAt],
    })),
    { sql: 'COMMIT' },
  ]);
}

function sqliteListAllRecords(filePath: string): StoredRecord[] {
  const database = openSqliteDatabase(filePath);
  try {
    return database
      .prepare(
        `
          SELECT table_name AS tableName, id, payload, updated_at AS updatedAt
          FROM records
          ORDER BY rowid ASC
        `,
      )
      .all()
      .map((row) => ({
        tableName: String(row.tableName),
        id: String(row.id),
        payload: String(row.payload),
        updatedAt: String(row.updatedAt),
      }));
  } finally {
    database.close();
  }
}

function sqliteReplaceAllRecords(filePath: string, records: StoredRecord[]): void {
  const database = openSqliteDatabase(filePath);
  try {
    database.exec('BEGIN IMMEDIATE');
    database.prepare('DELETE FROM records').run();

    const insertStatement = database.prepare(
      `
        INSERT INTO records (table_name, id, payload, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(table_name, id) DO UPDATE
        SET payload = excluded.payload,
            updated_at = excluded.updated_at
      `,
    );

    for (const record of records) {
      insertStatement.run(record.tableName, record.id, record.payload, record.updatedAt);
    }

    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

function listAllRecordsFromTarget(target: DatabaseTarget): StoredRecord[] {
  if (target.provider === 'postgres') {
    if (isRelationalPostgresMode()) {
      initializeRelationalPostgresDatabase(target.config);
      return relationalPostgresListAllRecords(target.config);
    }

    initializePostgresDatabase(target.config);
    return postgresListAllRecords(target.config);
  }

  if (target.provider === 'mysql') {
    initializeMysqlDatabase(target.config);
    return mysqlListAllRecords(target.config);
  }

  ensureSqliteFile(target.path);
  return sqliteListAllRecords(target.path);
}

function replaceAllRecordsInTarget(target: DatabaseTarget, records: StoredRecord[]): void {
  if (target.provider === 'postgres') {
    if (isRelationalPostgresMode()) {
      relationalPostgresReplaceAllRecords(target.config, toCanonicalStoredRecords(records));
    } else {
      initializePostgresDatabase(target.config);
      postgresReplaceAllRecords(target.config, records);
    }
    return;
  }

  if (target.provider === 'mysql') {
    initializeMysqlDatabase(target.config);
    mysqlReplaceAllRecords(target.config, records);
    return;
  }

  sqliteReplaceAllRecords(target.path, records);
}

function toCanonicalStoredRecords(records: StoredRecord[]): Array<{
  tableName: TableName;
  id: string;
  payload: string;
  updatedAt: string;
}> {
  return records
    .filter((record) => TABLE_NAMES.includes(record.tableName as TableName))
    .map((record) => ({
      tableName: record.tableName as TableName,
      id: record.id,
      payload: record.payload,
      updatedAt: record.updatedAt,
    }));
}

function migrateRecordsBetweenTargets(currentTarget: DatabaseTarget, nextTarget: DatabaseTarget): void {
  replaceAllRecordsInTarget(nextTarget, listAllRecordsFromTarget(currentTarget));
}

function getSqlReadCacheTtlMs(): number {
  const configuredValue = process.env[SQL_READ_CACHE_TTL_ENV]?.trim();
  if (!configuredValue) {
    return DEFAULT_SQL_READ_CACHE_TTL_MS;
  }

  const parsedValue = Number(configuredValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : DEFAULT_SQL_READ_CACHE_TTL_MS;
}

function createEmptyTableCounts(): Record<string, number> {
  return Object.fromEntries(TABLE_NAMES.map((table) => [table, 0]));
}

function groupStoredRecordsByTable(records: StoredRecord[]): {
  recordsByTable: Map<TableName, StoredRecord[]>;
  tableCounts: Record<string, number>;
} {
  const recordsByTable = new Map<TableName, StoredRecord[]>(TABLE_NAMES.map((table) => [table, []]));
  const tableCounts = createEmptyTableCounts();

  for (const record of records) {
    if (!TABLE_NAMES.includes(record.tableName as TableName)) {
      continue;
    }

    const tableName = record.tableName as TableName;
    recordsByTable.get(tableName)?.push(record);
    tableCounts[tableName] += 1;
  }

  return {
    recordsByTable,
    tableCounts,
  };
}

function sqliteCountRows(database: SqliteDatabase): Record<string, number> {
  const rows = database
    .prepare('SELECT table_name AS tableName, COUNT(*) AS count FROM records GROUP BY table_name')
    .all();
  const counts = Object.fromEntries(TABLE_NAMES.map((table) => [table, 0]));

  for (const row of rows) {
    const tableName = String(row.tableName ?? '');
    if (tableName in counts) {
      counts[tableName] = Number(row.count ?? 0);
    }
  }

  return counts;
}

export class DbService {
  private static activeConnection: ActiveDatabaseConnection | null = null;
  private static sqlReadCache: SqlReadCache | null = null;

  list<T>(table: TableName): T[] {
    const activeConnection = this.database();

    if (activeConnection.target.provider === 'postgres') {
      if (isRelationalPostgresMode()) {
        return this.listRelationalPayloads(activeConnection.target, table).map((row) => JSON.parse(row.payload) as T);
      }

      return this.listSqlPayloads(activeConnection.target, table).map((row) => JSON.parse(row.payload) as T);
    }

    if (activeConnection.target.provider === 'mysql') {
      return this.listSqlPayloads(activeConnection.target, table).map((row) => JSON.parse(row.payload) as T);
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite bağlantısı açılamadı.');
    }

    const rows = sqlite
      .prepare('SELECT payload FROM records WHERE table_name = ? ORDER BY rowid ASC')
      .all(table);

    return rows.map((row) => JSON.parse(String(row.payload)) as T);
  }

  insert<T extends { id: string }>(table: TableName, row: T): T {
    if (!row.id?.trim()) {
      throw new Error(`Table "${table}" için geçerli bir id gereklidir.`);
    }

    const activeConnection = this.database();
    const updatedAt = new Date().toISOString();

    if (activeConnection.target.provider === 'postgres') {
      if (isRelationalPostgresMode()) {
        relationalPostgresInsertRecord(activeConnection.target.config, table, row);
        DbService.invalidateSqlReadCache(activeConnection.target.key);
        return row;
      }

      postgresInsertRecord(activeConnection.target.config, table, row, updatedAt);
      DbService.invalidateSqlReadCache(activeConnection.target.key);
      return row;
    }

    if (activeConnection.target.provider === 'mysql') {
      mysqlInsertRecord(activeConnection.target.config, table, row, updatedAt);
      DbService.invalidateSqlReadCache(activeConnection.target.key);
      return row;
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite bağlantısı açılamadı.');
    }

    sqlite
      .prepare(
        `
          INSERT INTO records (table_name, id, payload, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(table_name, id) DO UPDATE
          SET payload = excluded.payload,
              updated_at = excluded.updated_at
        `,
      )
      .run(table, row.id, JSON.stringify(row), updatedAt);

    return row;
  }

  findById<T extends { id: string }>(table: TableName, id: string): T | undefined {
    const activeConnection = this.database();
    const row =
      activeConnection.target.provider === 'postgres' && isRelationalPostgresMode()
        ? this.listRelationalPayloads(activeConnection.target, table).find((record) => record.id === id)
        : activeConnection.target.provider === 'postgres'
        ? this.listSqlPayloads(activeConnection.target, table).find((record) => record.id === id)
        : activeConnection.target.provider === 'mysql'
          ? this.listSqlPayloads(activeConnection.target, table).find((record) => record.id === id)
          : (() => {
              const sqlite = activeConnection.sqlite;
              if (!sqlite) {
                throw new Error('SQLite bağlantısı açılamadı.');
              }

              return sqlite
                .prepare('SELECT payload FROM records WHERE table_name = ? AND id = ?')
                .get(table, id);
            })();

    if (!row) {
      return undefined;
    }

    return JSON.parse(String(row.payload)) as T;
  }

  updateById<T extends { id: string }>(table: TableName, id: string, patch: Partial<T>): T | undefined {
    const currentRow = this.findById<T>(table, id);
    if (!currentRow) {
      return undefined;
    }

    return this.insert<T>(table, {
      ...currentRow,
      ...patch,
      id,
    });
  }

  deleteById(table: TableName, id: string): boolean {
    const activeConnection = this.database();

    if (activeConnection.target.provider === 'postgres') {
      if (isRelationalPostgresMode()) {
        const deleted = relationalPostgresDeleteRecord(activeConnection.target.config, table, id);
        if (deleted) {
          DbService.invalidateSqlReadCache(activeConnection.target.key);
        }
        return deleted;
      }

      const deleted = postgresDeleteRecord(activeConnection.target.config, table, id);
      if (deleted) {
        DbService.invalidateSqlReadCache(activeConnection.target.key);
      }
      return deleted;
    }

    if (activeConnection.target.provider === 'mysql') {
      const deleted = mysqlDeleteRecord(activeConnection.target.config, table, id);
      if (deleted) {
        DbService.invalidateSqlReadCache(activeConnection.target.key);
      }
      return deleted;
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite bağlantısı açılamadı.');
    }

    const result = sqlite
      .prepare('DELETE FROM records WHERE table_name = ? AND id = ?')
      .run(table, id) as { changes?: number | bigint };

    return Number(result.changes ?? 0) > 0;
  }

  getDatabaseSettings(): DatabaseSettingsSnapshot {
    const config = readBootstrapConfig();
    const activeTarget = getActiveDatabaseTarget(config);
    const tableCounts = this.getTableCounts();

    return {
      defaultSqliteUrl: config.localDatabaseUrl,
      activeProvider: activeTarget.provider,
      activeDatabaseUrl: activeTarget.url,
      externalDatabaseUrl: config.externalDatabaseUrl,
      mysqlDatabase: toMysqlSnapshot(config.externalMysqlDatabase),
      postgresDatabase: toPostgresSnapshot(config.externalPostgresDatabase),
      isUsingExternalDatabase:
        activeTarget.provider === 'mysql' ||
        activeTarget.provider === 'postgres' ||
        Boolean(config.externalDatabaseUrl),
      migratedAt: config.migratedAt,
      tableCounts,
    };
  }

  updateDatabaseSettings(input: string | UpdateDatabaseSettingsInput | null | undefined): DatabaseSettingsSnapshot {
    const payload = normalizeUpdateInput(input);
    const currentConfig = readBootstrapConfig();
    const now = new Date().toISOString();
    const localDatabasePath = resolveSqlitePath(currentConfig.localDatabaseUrl);
    const currentActiveTarget = getActiveDatabaseTarget(currentConfig);

    ensureSqliteFile(localDatabasePath);
    this.database();

    const mysqlDatabase = normalizeMysqlDatabaseSettings(payload.mysql, currentConfig);
    const postgresDatabase = normalizePostgresDatabaseSettings(payload.postgres, currentConfig);
    if (mysqlDatabase && postgresDatabase) {
      throw new Error('Aynı anda yalnızca bir harici SQL provider aktif edilebilir.');
    }

    const nextConfig: BootstrapConfig = {
      ...currentConfig,
      activeProvider: postgresDatabase ? 'postgres' : mysqlDatabase ? 'mysql' : 'sqlite',
      externalDatabaseUrl: normalizeExternalDatabaseUrl(payload.externalDatabaseUrl, currentConfig.localDatabaseUrl),
      externalMysqlDatabase: mysqlDatabase,
      externalPostgresDatabase: postgresDatabase,
      updatedAt: now,
      migratedAt: currentConfig.migratedAt,
    };

    const nextActiveTarget = getActiveDatabaseTarget(nextConfig);

    if (!targetsEqual(currentActiveTarget, nextActiveTarget)) {
      DbService.closeDatabase();

      if (currentActiveTarget.provider === 'sqlite' && nextActiveTarget.provider === 'sqlite') {
        ensureParentDirectory(nextActiveTarget.path);
        copyFileSync(currentActiveTarget.path, nextActiveTarget.path);
      } else {
        migrateRecordsBetweenTargets(currentActiveTarget, nextActiveTarget);
      }

      nextConfig.migratedAt = now;
    }

    writeBootstrapConfig(nextConfig);
    DbService.closeDatabase();

    return this.getDatabaseSettings();
  }

  testDatabaseConnection(input: TestDatabaseConnectionInput): DatabaseConnectionTestResult {
    const payload = normalizeUpdateInput(input);
    const currentConfig = readBootstrapConfig();
    const mysqlDatabase = normalizeMysqlDatabaseSettings(payload.mysql, currentConfig);
    const postgresDatabase = normalizePostgresDatabaseSettings(payload.postgres, currentConfig);
    if (mysqlDatabase && postgresDatabase) {
      return {
        ok: false,
        provider: null,
        message: 'Aynı anda yalnızca bir harici SQL provider test edilebilir.',
        resolvedDatabaseUrl: null,
      };
    }

    if (postgresDatabase) {
      try {
        testPostgresConnection(postgresDatabase);
        return {
          ok: true,
          provider: 'postgres',
          message: 'Postgres bağlantısı başarılı.',
          resolvedDatabaseUrl: toPostgresDisplayUrl(postgresDatabase),
        };
      } catch (error) {
        return {
          ok: false,
          provider: 'postgres',
          message: error instanceof Error ? error.message : 'Postgres bağlantısı test edilemedi.',
          resolvedDatabaseUrl: toPostgresDisplayUrl(postgresDatabase),
        };
      }
    }

    if (mysqlDatabase) {
      try {
        testMysqlConnection(mysqlDatabase);
        return {
          ok: true,
          provider: 'mysql',
          message: 'MySQL bağlantısı başarılı.',
          resolvedDatabaseUrl: toMysqlDisplayUrl(mysqlDatabase),
        };
      } catch (error) {
        return {
          ok: false,
          provider: 'mysql',
          message: error instanceof Error ? error.message : 'MySQL bağlantısı test edilemedi.',
          resolvedDatabaseUrl: toMysqlDisplayUrl(mysqlDatabase),
        };
      }
    }

    const externalDatabaseUrl = payload.externalDatabaseUrl?.trim();
    if (!externalDatabaseUrl) {
      return {
        ok: false,
        provider: null,
        message: 'Test için harici SQLite path veya MySQL bağlantı bilgisi girin.',
        resolvedDatabaseUrl: null,
      };
    }

    const sqliteTarget = getSqliteTarget(externalDatabaseUrl);
    try {
      testSqliteConnection(sqliteTarget.path);
      return {
        ok: true,
        provider: 'sqlite',
        message: 'SQLite bağlantısı başarılı.',
        resolvedDatabaseUrl: sqliteTarget.url,
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'sqlite',
        message: error instanceof Error ? error.message : 'SQLite bağlantısı test edilemedi.',
        resolvedDatabaseUrl: sqliteTarget.url,
      };
    }
  }

  migrateActivePostgresRecordsToRelational(): DatabaseSettingsSnapshot {
    const config = readBootstrapConfig();
    const activeTarget = getActiveDatabaseTarget(config);

    if (activeTarget.provider !== 'postgres') {
      throw new Error('Relational migration can only run when the active provider is Postgres.');
    }

    initializePostgresDatabase(activeTarget.config);
    const legacyRecords = postgresListAllRecords(activeTarget.config);
    relationalPostgresReplaceAllRecords(activeTarget.config, toCanonicalStoredRecords(legacyRecords));
    DbService.closeDatabase();

    return this.getDatabaseSettings();
  }

  private getTableCounts(): Record<string, number> {
    const activeConnection = this.database();

    if (activeConnection.target.provider === 'postgres') {
      if (isRelationalPostgresMode()) {
        return this.getRelationalTableCounts(activeConnection.target);
      }

      return this.getSqlTableCounts(activeConnection.target);
    }

    if (activeConnection.target.provider === 'mysql') {
      return this.getSqlTableCounts(activeConnection.target);
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite bağlantısı açılamadı.');
    }

    return sqliteCountRows(sqlite);
  }

  private database(): ActiveDatabaseConnection {
    const config = readBootstrapConfig();
    const localDatabasePath = resolveSqlitePath(config.localDatabaseUrl);
    const activeTarget = getActiveDatabaseTarget(config);

    ensureSqliteFile(localDatabasePath);

    if (activeTarget.provider === 'sqlite' && config.externalDatabaseUrl && !existsSync(activeTarget.path)) {
      ensureParentDirectory(activeTarget.path);
      copyFileSync(localDatabasePath, activeTarget.path);
    }

    if (DbService.activeConnection && targetsEqual(DbService.activeConnection.target, activeTarget)) {
      return DbService.activeConnection;
    }

    DbService.closeDatabase();

    if (activeTarget.provider === 'postgres') {
      if (isRelationalPostgresMode()) {
        initializeRelationalPostgresDatabase(activeTarget.config);
      } else {
        initializePostgresDatabase(activeTarget.config);
      }
      DbService.activeConnection = {
        target: activeTarget,
        sqlite: null,
      };
      return DbService.activeConnection;
    }

    if (activeTarget.provider === 'mysql') {
      initializeMysqlDatabase(activeTarget.config);
      DbService.activeConnection = {
        target: activeTarget,
        sqlite: null,
      };
      return DbService.activeConnection;
    }

    DbService.activeConnection = {
      target: activeTarget,
      sqlite: openSqliteDatabase(activeTarget.path),
    };

    return DbService.activeConnection;
  }

  private static closeDatabase(): void {
    if (DbService.activeConnection?.sqlite) {
      DbService.activeConnection.sqlite.close();
    }

    DbService.activeConnection = null;
    DbService.sqlReadCache = null;
  }

  private listSqlPayloads(target: SqlDatabaseTarget, table: TableName): StoredRecord[] {
    const cache = this.getSqlReadCache(target);
    if (cache) {
      return cache.recordsByTable.get(table) ?? [];
    }

    const rows =
      target.provider === 'postgres'
        ? postgresListPayloads(target.config, table)
        : mysqlListPayloads(target.config, table);

    return rows.map((row) => ({
      tableName: table,
      id: String(row.id),
      payload: String(row.payload),
      updatedAt: String(row.updatedAt ?? ''),
    }));
  }

  private listRelationalPayloads(target: PostgresDatabaseTarget, table: TableName): StoredRecord[] {
    const cache = this.getRelationalReadCache(target);
    if (cache) {
      return cache.recordsByTable.get(table) ?? [];
    }

    return relationalPostgresListPayloads(target.config, table);
  }

  private getSqlTableCounts(target: SqlDatabaseTarget): Record<string, number> {
    const cache = this.getSqlReadCache(target);
    if (cache) {
      return { ...cache.tableCounts };
    }

    return target.provider === 'postgres'
      ? postgresCountRows(target.config)
      : mysqlCountRows(target.config);
  }

  private getRelationalTableCounts(target: PostgresDatabaseTarget): Record<string, number> {
    const cache = this.getRelationalReadCache(target);
    if (cache) {
      return { ...cache.tableCounts };
    }

    return relationalPostgresCountRows(target.config);
  }

  private getSqlReadCache(target: SqlDatabaseTarget): SqlReadCache | null {
    const ttlMs = getSqlReadCacheTtlMs();
    if (ttlMs <= 0) {
      return null;
    }

    const now = Date.now();
    if (
      DbService.sqlReadCache &&
      DbService.sqlReadCache.targetKey === target.key &&
      DbService.sqlReadCache.expiresAtMs > now
    ) {
      return DbService.sqlReadCache;
    }

    const records =
      target.provider === 'postgres'
        ? postgresListAllRecords(target.config)
        : mysqlListAllRecords(target.config);
    const groupedRecords = groupStoredRecordsByTable(records);
    DbService.sqlReadCache = {
      targetKey: target.key,
      expiresAtMs: now + ttlMs,
      recordsByTable: groupedRecords.recordsByTable,
      tableCounts: groupedRecords.tableCounts,
    };

    return DbService.sqlReadCache;
  }

  private getRelationalReadCache(target: PostgresDatabaseTarget): SqlReadCache | null {
    const ttlMs = getSqlReadCacheTtlMs();
    if (ttlMs <= 0) {
      return null;
    }

    const now = Date.now();
    const targetKey = `${target.key}:relational`;
    if (
      DbService.sqlReadCache &&
      DbService.sqlReadCache.targetKey === targetKey &&
      DbService.sqlReadCache.expiresAtMs > now
    ) {
      return DbService.sqlReadCache;
    }

    const groupedRecords = groupStoredRecordsByTable(relationalPostgresListAllRecords(target.config));
    DbService.sqlReadCache = {
      targetKey,
      expiresAtMs: now + ttlMs,
      recordsByTable: groupedRecords.recordsByTable,
      tableCounts: groupedRecords.tableCounts,
    };

    return DbService.sqlReadCache;
  }

  private static invalidateSqlReadCache(targetKey?: string): void {
    if (!targetKey || DbService.sqlReadCache?.targetKey.startsWith(targetKey)) {
      DbService.sqlReadCache = null;
    }
  }
}
