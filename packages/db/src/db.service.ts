import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storyPlatformTableNames, type StoryPlatformTableName } from '../../contracts/src/persistence.ts';
import {
  initializeRelationalPostgresDatabase,
  relationalPostgresCountRows,
  relationalPostgresDeleteRecord,
  relationalPostgresInsertRecord,
  relationalPostgresListAllRecords,
  relationalPostgresListPayloads,
  relationalPostgresTestConnection,
} from './relational-postgres-store.ts';

const require = createRequire(import.meta.url);

export type TableName = StoryPlatformTableName;
export type DatabaseProvider = 'sqlite' | 'postgres';
export type PostgresSslMode = 'disable' | 'require';

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
  externalPostgresDatabase: PostgresExternalDatabaseConfig | null;
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

type PostgresDatabaseTarget = {
  provider: 'postgres';
  key: string;
  url: string;
  config: PostgresExternalDatabaseConfig;
};

type DatabaseTarget = SqliteDatabaseTarget | PostgresDatabaseTarget;

type ActiveDatabaseConnection =
  | {
      target: SqliteDatabaseTarget;
      sqlite: SqliteDatabase;
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

export type PostgresDatabaseSettingsSnapshot = {
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode: PostgresSslMode;
  passwordConfigured: boolean;
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
  postgresDatabase: PostgresDatabaseSettingsSnapshot | null;
  isUsingExternalDatabase: boolean;
  tableCounts: Record<string, number>;
}

const TABLE_NAMES: TableName[] = [...storyPlatformTableNames];

const SQLITE_FILENAME = 'open-story.sqlite';
const CONFIG_FILENAME = 'database-config.json';
const SQLITE_PATH_ENV = 'OPEN_STORY_SQLITE_PATH';
const CONFIG_PATH_ENV = 'OPEN_STORY_DB_CONFIG_PATH';
const POSTGRES_DEFAULT_PORT = 5432;
const SQL_READ_CACHE_TTL_ENV = 'OPEN_STORY_DB_READ_CACHE_TTL_MS';
const DEFAULT_SQL_READ_CACHE_TTL_MS = 5_000;
const POSTGRES_HOST_ENV = 'OPEN_STORY_POSTGRES_HOST';
const POSTGRES_PORT_ENV = 'OPEN_STORY_POSTGRES_PORT';
const POSTGRES_DATABASE_ENV = 'OPEN_STORY_POSTGRES_DATABASE';
const POSTGRES_USERNAME_ENV = 'OPEN_STORY_POSTGRES_USERNAME';
const POSTGRES_PASSWORD_ENV = 'OPEN_STORY_POSTGRES_PASSWORD';
const POSTGRES_SSL_MODE_ENV = 'OPEN_STORY_POSTGRES_SSL_MODE';

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
  const envPostgresDatabaseConfig = readEnvPostgresDatabaseConfig();
  assertProductionPostgresConfigured(envPostgresDatabaseConfig);

  return {
    version: 3,
    activeProvider: envPostgresDatabaseConfig ? 'postgres' : 'sqlite',
    localDatabaseUrl: toFileUrl(resolveLocalDatabasePath()),
    externalPostgresDatabase: envPostgresDatabaseConfig,
    updatedAt: now,
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

function readEnvPostgresDatabaseConfig(): PostgresExternalDatabaseConfig | null {
  const host = readString(process.env[POSTGRES_HOST_ENV]);
  const database = readString(process.env[POSTGRES_DATABASE_ENV]);
  const username = readString(process.env[POSTGRES_USERNAME_ENV]);
  const password = typeof process.env[POSTGRES_PASSWORD_ENV] === 'string' ? process.env[POSTGRES_PASSWORD_ENV] : '';

  if (!host || !database || !username) {
    return null;
  }

  const port = normalizePostgresPort(process.env[POSTGRES_PORT_ENV]);

  return {
    host,
    port,
    database,
    username,
    password,
    sslMode: parsePostgresSslMode(process.env[POSTGRES_SSL_MODE_ENV]),
  };
}

function parseConfig(rawValue: string): BootstrapConfig {
  const parsed = JSON.parse(rawValue) as Partial<BootstrapConfig>;
  const now = new Date().toISOString();
  const envPostgresDatabaseConfig = readEnvPostgresDatabaseConfig();
  const localDatabaseUrl = toFileUrl(resolveLocalDatabasePath());
  const externalPostgresDatabase =
    parsePostgresDatabaseConfig(parsed.externalPostgresDatabase) ?? envPostgresDatabaseConfig;
  assertProductionPostgresConfigured(externalPostgresDatabase);
  const activeProvider: DatabaseProvider = externalPostgresDatabase ? 'postgres' : 'sqlite';

  return {
    version: 3,
    activeProvider,
    localDatabaseUrl:
      typeof parsed.localDatabaseUrl === 'string' && parsed.localDatabaseUrl.trim()
        ? toFileUrl(resolveSqlitePath(parsed.localDatabaseUrl))
        : localDatabaseUrl,
    externalPostgresDatabase,
    updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim() ? parsed.updatedAt : now,
  };
}

function assertProductionPostgresConfigured(config: PostgresExternalDatabaseConfig | null): void {
  if (process.env.NODE_ENV === 'production' && !config) {
    throw new Error(
      'Production runtime için Postgres bağlantısı gereklidir. OPEN_STORY_POSTGRES_* env değişkenlerini veya database-config.json içindeki Postgres ayarını kullanın.',
    );
  }
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

function toPostgresDisplayUrl(config: PostgresExternalDatabaseConfig): string {
  const username = encodeURIComponent(config.username);
  const database = encodeURIComponent(config.database);
  return `postgresql://${username}@${config.host}:${config.port}/${database}?sslmode=${config.sslMode}`;
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
  if (config.externalPostgresDatabase) {
    return {
      provider: 'postgres',
      key: `postgres:${toPostgresConnectionKey(config.externalPostgresDatabase)}`,
      url: toPostgresDisplayUrl(config.externalPostgresDatabase),
      config: config.externalPostgresDatabase,
    };
  }

  return getSqliteTarget(config.localDatabaseUrl);
}

function targetsEqual(left: DatabaseTarget, right: DatabaseTarget): boolean {
  return left.key === right.key;
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

function postgresIdentityMatches(left: PostgresExternalDatabaseConfig, right: PostgresExternalDatabaseConfig): boolean {
  return (
    left.host === right.host &&
    left.port === right.port &&
    left.database === right.database &&
    left.username === right.username &&
    left.sslMode === right.sslMode
  );
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
    return {};
  }

  return input;
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

function testPostgresConnection(config: PostgresExternalDatabaseConfig): void {
  relationalPostgresTestConnection(config);
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
      return this.listRelationalPayloads(activeConnection.target, table).map((row) => JSON.parse(row.payload) as T);
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

    if (activeConnection.target.provider === 'postgres') {
      relationalPostgresInsertRecord(activeConnection.target.config, table, row);
      DbService.invalidateSqlReadCache(activeConnection.target.key);
      return row;
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite bağlantısı açılamadı.');
    }
    const updatedAt = new Date().toISOString();

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
      activeConnection.target.provider === 'postgres'
        ? this.listRelationalPayloads(activeConnection.target, table).find((record) => record.id === id)
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
      const deleted = relationalPostgresDeleteRecord(activeConnection.target.config, table, id);
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
      postgresDatabase: toPostgresSnapshot(config.externalPostgresDatabase),
      isUsingExternalDatabase: activeTarget.provider === 'postgres',
      tableCounts,
    };
  }

  updateDatabaseSettings(input: string | UpdateDatabaseSettingsInput | null | undefined): DatabaseSettingsSnapshot {
    const payload = normalizeUpdateInput(input);
    const currentConfig = readBootstrapConfig();
    const now = new Date().toISOString();
    const postgresDatabase = normalizePostgresDatabaseSettings(payload.postgres, currentConfig);
    if (!postgresDatabase) {
      throw new Error('Postgres bağlantı bilgileri gereklidir.');
    }

    const nextConfig: BootstrapConfig = {
      ...currentConfig,
      activeProvider: 'postgres',
      externalPostgresDatabase: postgresDatabase,
      updatedAt: now,
    };

    writeBootstrapConfig(nextConfig);
    DbService.closeDatabase();
    initializeRelationalPostgresDatabase(postgresDatabase);

    return this.getDatabaseSettings();
  }

  testDatabaseConnection(input: TestDatabaseConnectionInput): DatabaseConnectionTestResult {
    const payload = normalizeUpdateInput(input);
    const currentConfig = readBootstrapConfig();
    const postgresDatabase = normalizePostgresDatabaseSettings(payload.postgres, currentConfig);

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

    return {
      ok: false,
      provider: null,
      message: 'Test için Postgres bağlantı bilgisi girin.',
      resolvedDatabaseUrl: null,
    };
  }

  private getTableCounts(): Record<string, number> {
    const activeConnection = this.database();

    if (activeConnection.target.provider === 'postgres') {
      return this.getRelationalTableCounts(activeConnection.target);
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite bağlantısı açılamadı.');
    }

    return sqliteCountRows(sqlite);
  }

  private database(): ActiveDatabaseConnection {
    const config = readBootstrapConfig();
    const activeTarget = getActiveDatabaseTarget(config);

    if (DbService.activeConnection && targetsEqual(DbService.activeConnection.target, activeTarget)) {
      return DbService.activeConnection;
    }

    DbService.closeDatabase();

    if (activeTarget.provider === 'postgres') {
      initializeRelationalPostgresDatabase(activeTarget.config);
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

  private listRelationalPayloads(target: PostgresDatabaseTarget, table: TableName): StoredRecord[] {
    const cache = this.getRelationalReadCache(target);
    if (cache) {
      return cache.recordsByTable.get(table) ?? [];
    }

    return relationalPostgresListPayloads(target.config, table);
  }

  private getRelationalTableCounts(target: PostgresDatabaseTarget): Record<string, number> {
    const cache = this.getRelationalReadCache(target);
    if (cache) {
      return { ...cache.tableCounts };
    }

    return relationalPostgresCountRows(target.config);
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
