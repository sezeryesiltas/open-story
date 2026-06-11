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
  relationalPostgresInsertRecords,
  relationalPostgresListAllRecords,
  relationalPostgresListPayloads,
  relationalPostgresTestConnection,
} from './relational-postgres-store.ts';
import {
  initializeRelationalMysqlDatabase,
  relationalMysqlCountRows,
  relationalMysqlDeleteRecord,
  relationalMysqlInsertRecord,
  relationalMysqlInsertRecords,
  relationalMysqlListAllRecords,
  relationalMysqlListPayloads,
  relationalMysqlTestConnection,
} from './relational-mysql-store.ts';

const require = createRequire(import.meta.url);

export type TableName = StoryPlatformTableName;
export type DatabaseProvider = 'sqlite' | 'postgres' | 'mysql';
export type PostgresSslMode = 'disable' | 'require';
export type MysqlSslMode = 'disable' | 'require';
export type MysqlIpType = 'PUBLIC' | 'PRIVATE' | 'PSC';

type PostgresExternalDatabaseConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode: PostgresSslMode;
};

type MysqlExternalDatabaseConfig = {
  host: string | null;
  port: number;
  socketPath: string | null;
  instanceConnectionName: string | null;
  ipType: MysqlIpType;
  database: string;
  username: string;
  password: string;
  sslMode: MysqlSslMode;
};

type BootstrapConfig = {
  version: 4;
  activeProvider: DatabaseProvider;
  localDatabaseUrl: string;
  externalPostgresDatabase: PostgresExternalDatabaseConfig | null;
  externalMysqlDatabase: MysqlExternalDatabaseConfig | null;
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

type MysqlDatabaseTarget = {
  provider: 'mysql';
  key: string;
  url: string;
  config: MysqlExternalDatabaseConfig;
};

type RelationalDatabaseTarget = PostgresDatabaseTarget | MysqlDatabaseTarget;
type DatabaseTarget = SqliteDatabaseTarget | RelationalDatabaseTarget;

type ActiveDatabaseConnection =
  | {
      target: SqliteDatabaseTarget;
      sqlite: SqliteDatabase;
    }
  | {
      target: RelationalDatabaseTarget;
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

export type MysqlDatabaseSettingsSnapshot = {
  host: string | null;
  port: number;
  socketPath: string | null;
  instanceConnectionName: string | null;
  ipType: MysqlIpType;
  database: string;
  username: string;
  sslMode: MysqlSslMode;
  passwordConfigured: boolean;
  configuredFromEnvironment: boolean;
};

export type UpdateMysqlDatabaseSettingsInput = {
  host?: string | null;
  port?: string | number | null;
  socketPath?: string | null;
  instanceConnectionName?: string | null;
  ipType?: MysqlIpType | null;
  database?: string | null;
  username?: string | null;
  password?: string | null;
  sslMode?: MysqlSslMode | null;
};

export interface UpdateDatabaseSettingsInput {
  postgres?: UpdatePostgresDatabaseSettingsInput | null;
  mysql?: UpdateMysqlDatabaseSettingsInput | null;
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
  mysqlDatabase: MysqlDatabaseSettingsSnapshot | null;
  isUsingExternalDatabase: boolean;
  tableCounts: Record<string, number>;
}

const TABLE_NAMES: TableName[] = [...storyPlatformTableNames];

const SQLITE_FILENAME = 'open-story.sqlite';
const CONFIG_FILENAME = 'database-config.json';
const SQLITE_PATH_ENV = 'OPEN_STORY_SQLITE_PATH';
const CONFIG_PATH_ENV = 'OPEN_STORY_DB_CONFIG_PATH';
const DATABASE_PROVIDER_ENV = 'OPEN_STORY_DB_PROVIDER';
const POSTGRES_DEFAULT_PORT = 5432;
const MYSQL_DEFAULT_PORT = 3306;
const SQL_READ_CACHE_TTL_ENV = 'OPEN_STORY_DB_READ_CACHE_TTL_MS';
const DEFAULT_SQL_READ_CACHE_TTL_MS = 5_000;
const POSTGRES_HOST_ENV = 'OPEN_STORY_POSTGRES_HOST';
const POSTGRES_PORT_ENV = 'OPEN_STORY_POSTGRES_PORT';
const POSTGRES_DATABASE_ENV = 'OPEN_STORY_POSTGRES_DATABASE';
const POSTGRES_USERNAME_ENV = 'OPEN_STORY_POSTGRES_USERNAME';
const POSTGRES_PASSWORD_ENV = 'OPEN_STORY_POSTGRES_PASSWORD';
const POSTGRES_SSL_MODE_ENV = 'OPEN_STORY_POSTGRES_SSL_MODE';
const MYSQL_HOST_ENV = 'OPEN_STORY_MYSQL_HOST';
const MYSQL_PORT_ENV = 'OPEN_STORY_MYSQL_PORT';
const MYSQL_SOCKET_PATH_ENV = 'OPEN_STORY_MYSQL_SOCKET_PATH';
const MYSQL_INSTANCE_CONNECTION_NAME_ENV = 'OPEN_STORY_MYSQL_INSTANCE_CONNECTION_NAME';
const MYSQL_IP_TYPE_ENV = 'OPEN_STORY_MYSQL_IP_TYPE';
const MYSQL_DATABASE_ENV = 'OPEN_STORY_MYSQL_DATABASE';
const MYSQL_USERNAME_ENV = 'OPEN_STORY_MYSQL_USERNAME';
const MYSQL_PASSWORD_ENV = 'OPEN_STORY_MYSQL_PASSWORD';
const MYSQL_SSL_MODE_ENV = 'OPEN_STORY_MYSQL_SSL_MODE';
const MYSQL_ENV_KEYS = [
  MYSQL_HOST_ENV,
  MYSQL_PORT_ENV,
  MYSQL_SOCKET_PATH_ENV,
  MYSQL_INSTANCE_CONNECTION_NAME_ENV,
  MYSQL_IP_TYPE_ENV,
  MYSQL_DATABASE_ENV,
  MYSQL_USERNAME_ENV,
  MYSQL_PASSWORD_ENV,
  MYSQL_SSL_MODE_ENV,
] as const;

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
    throw new Error('Database URL or path cannot be empty.');
  }

  if (normalizedInput.startsWith('file://')) {
    return normalize(fileURLToPath(normalizedInput));
  }

  if (normalizedInput.startsWith('sqlite://')) {
    const value = normalizedInput.slice('sqlite://'.length);
    if (!value) {
      throw new Error('sqlite URL must contain a valid file path.');
    }

    return normalize(isAbsolute(value) ? value : resolve(process.cwd(), value));
  }

  if (/^[a-zA-Z]+:\/\//.test(normalizedInput)) {
    throw new Error('This version only supports sqlite/file-based database URL formats for sqlite.');
  }

  return normalize(isAbsolute(normalizedInput) ? normalizedInput : resolve(process.cwd(), normalizedInput));
}

function toFileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

function resolveDefaultLocalDatabasePath(): string {
  return resolve(resolveDefaultDataDir(), SQLITE_FILENAME);
}

function resolveConfigPath(): string {
  const configuredPath = process.env[CONFIG_PATH_ENV]?.trim();
  if (configuredPath) {
    return resolveSqlitePath(configuredPath);
  }

  return resolve(resolveDefaultDataDir(), CONFIG_FILENAME);
}

function resolveDefaultLocalDatabaseUrl(): string {
  return toFileUrl(resolveDefaultLocalDatabasePath());
}

function createFallbackConfig(): BootstrapConfig {
  const now = new Date().toISOString();

  return {
    version: 4,
    activeProvider: 'sqlite',
    localDatabaseUrl: resolveDefaultLocalDatabaseUrl(),
    externalPostgresDatabase: null,
    externalMysqlDatabase: null,
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

function hasEnv(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(process.env, key);
}

function mergePostgresDatabaseConfig(
  currentConfig: PostgresExternalDatabaseConfig | null,
): PostgresExternalDatabaseConfig | null {
  const host = readString(process.env[POSTGRES_HOST_ENV]) ?? currentConfig?.host ?? null;
  const database = readString(process.env[POSTGRES_DATABASE_ENV]) ?? currentConfig?.database ?? null;
  const username = readString(process.env[POSTGRES_USERNAME_ENV]) ?? currentConfig?.username ?? null;

  if (!host || !database || !username) {
    return null;
  }

  const port = normalizePostgresPort(
    readString(process.env[POSTGRES_PORT_ENV]) ?? currentConfig?.port ?? POSTGRES_DEFAULT_PORT,
  );

  return {
    host,
    port,
    database,
    username,
    password: hasEnv(POSTGRES_PASSWORD_ENV)
      ? (process.env[POSTGRES_PASSWORD_ENV] ?? '')
      : (currentConfig?.password ?? ''),
    sslMode: hasEnv(POSTGRES_SSL_MODE_ENV)
      ? parsePostgresSslMode(process.env[POSTGRES_SSL_MODE_ENV])
      : (currentConfig?.sslMode ?? 'require'),
  };
}

function parseMysqlSslMode(value: unknown): MysqlSslMode {
  return value === 'require' ? 'require' : 'disable';
}

function parseMysqlIpType(value: unknown): MysqlIpType {
  return value === 'PRIVATE' || value === 'PSC' ? value : 'PUBLIC';
}

function parseMysqlDatabaseConfig(value: unknown): MysqlExternalDatabaseConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as Partial<MysqlExternalDatabaseConfig>;
  const host = readString(parsed.host);
  const socketPath = readString(parsed.socketPath);
  const instanceConnectionName = readString(parsed.instanceConnectionName);
  const database = readString(parsed.database);
  const username = readString(parsed.username);
  const port = Number(parsed.port);

  if ((!host && !socketPath && !instanceConnectionName) || !database || !username || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return {
    host,
    port,
    socketPath,
    instanceConnectionName,
    ipType: parseMysqlIpType(parsed.ipType),
    database,
    username,
    password: typeof parsed.password === 'string' ? parsed.password : '',
    sslMode: parseMysqlSslMode(parsed.sslMode),
  };
}

function mergeMysqlDatabaseConfig(
  currentConfig: MysqlExternalDatabaseConfig | null,
): MysqlExternalDatabaseConfig | null {
  const hasEndpointEnv =
    hasEnv(MYSQL_HOST_ENV) || hasEnv(MYSQL_SOCKET_PATH_ENV) || hasEnv(MYSQL_INSTANCE_CONNECTION_NAME_ENV);
  const host = hasEndpointEnv ? readString(process.env[MYSQL_HOST_ENV]) : currentConfig?.host ?? null;
  const socketPath = hasEndpointEnv
    ? readString(process.env[MYSQL_SOCKET_PATH_ENV])
    : currentConfig?.socketPath ?? null;
  const instanceConnectionName = hasEndpointEnv
    ? readString(process.env[MYSQL_INSTANCE_CONNECTION_NAME_ENV])
    : currentConfig?.instanceConnectionName ?? null;
  const database = readString(process.env[MYSQL_DATABASE_ENV]) ?? currentConfig?.database ?? null;
  const username = readString(process.env[MYSQL_USERNAME_ENV]) ?? currentConfig?.username ?? null;

  if ((!host && !socketPath && !instanceConnectionName) || !database || !username) {
    return null;
  }

  const port = normalizeMysqlPort(
    readString(process.env[MYSQL_PORT_ENV]) ?? currentConfig?.port ?? MYSQL_DEFAULT_PORT,
  );

  return {
    host,
    port,
    socketPath,
    instanceConnectionName,
    ipType: hasEnv(MYSQL_IP_TYPE_ENV)
      ? parseMysqlIpType(process.env[MYSQL_IP_TYPE_ENV])
      : (currentConfig?.ipType ?? 'PUBLIC'),
    database,
    username,
    password: hasEnv(MYSQL_PASSWORD_ENV)
      ? (process.env[MYSQL_PASSWORD_ENV] ?? '')
      : (currentConfig?.password ?? ''),
    sslMode: hasEnv(MYSQL_SSL_MODE_ENV)
      ? parseMysqlSslMode(process.env[MYSQL_SSL_MODE_ENV])
      : (currentConfig?.sslMode ?? 'disable'),
  };
}

function hasAnyEnv(keys: readonly string[]): boolean {
  return keys.some((key) => hasEnv(key));
}

function resolveConfiguredProvider(
  configuredProvider: DatabaseProvider,
  postgresDatabase: PostgresExternalDatabaseConfig | null,
  mysqlDatabase: MysqlExternalDatabaseConfig | null,
): DatabaseProvider {
  const envProvider = readString(process.env[DATABASE_PROVIDER_ENV]);
  if (envProvider && envProvider !== 'postgres' && envProvider !== 'mysql' && envProvider !== 'sqlite') {
    throw new Error(`${DATABASE_PROVIDER_ENV} must be one of: postgres, mysql, sqlite.`);
  }

  if (envProvider === 'mysql' || (!envProvider && hasAnyEnv(MYSQL_ENV_KEYS))) {
    if (!mysqlDatabase) {
      throw new Error('MySQL connection details are incomplete. Configure OPEN_STORY_MYSQL_* env variables.');
    }
    return 'mysql';
  }

  if (envProvider === 'postgres') {
    if (!postgresDatabase) {
      throw new Error('Postgres connection details are incomplete. Configure OPEN_STORY_POSTGRES_* env variables.');
    }
    return 'postgres';
  }

  if (envProvider === 'sqlite') {
    return 'sqlite';
  }

  if (configuredProvider === 'mysql' && mysqlDatabase) {
    return 'mysql';
  }

  if (configuredProvider === 'postgres' && postgresDatabase) {
    return 'postgres';
  }

  return postgresDatabase ? 'postgres' : mysqlDatabase ? 'mysql' : 'sqlite';
}

function parseConfig(rawValue: string): BootstrapConfig {
  const parsed = JSON.parse(rawValue) as Partial<BootstrapConfig>;
  const defaults = createFallbackConfig();
  const externalPostgresDatabase =
    parsePostgresDatabaseConfig(parsed.externalPostgresDatabase) ?? defaults.externalPostgresDatabase;
  const externalMysqlDatabase =
    parseMysqlDatabaseConfig(parsed.externalMysqlDatabase) ?? defaults.externalMysqlDatabase;
  const activeProvider =
    parsed.activeProvider === 'mysql' && externalMysqlDatabase
      ? 'mysql'
      : parsed.activeProvider === 'postgres' && externalPostgresDatabase
        ? 'postgres'
        : externalPostgresDatabase
          ? 'postgres'
          : externalMysqlDatabase
            ? 'mysql'
            : 'sqlite';

  return {
    version: 4,
    activeProvider,
    localDatabaseUrl:
      typeof parsed.localDatabaseUrl === 'string' && parsed.localDatabaseUrl.trim()
        ? toFileUrl(resolveSqlitePath(parsed.localDatabaseUrl))
        : defaults.localDatabaseUrl,
    externalPostgresDatabase,
    externalMysqlDatabase,
    updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim() ? parsed.updatedAt : defaults.updatedAt,
  };
}

function assertProductionRelationalDatabaseConfigured(provider: DatabaseProvider): void {
  if (process.env.NODE_ENV === 'production' && provider === 'sqlite') {
    throw new Error(
      'A Postgres or MySQL connection is required in production runtime. Use OPEN_STORY_POSTGRES_* or OPEN_STORY_MYSQL_* env variables, or configure a relational database in database-config.json.',
    );
  }
}

function readBootstrapConfig(): BootstrapConfig {
  const configPath = resolveConfigPath();
  ensureParentDirectory(configPath);

  if (!existsSync(configPath)) {
    const defaults = createFallbackConfig();
    writeFileSync(configPath, JSON.stringify(defaults, null, 2));
    return defaults;
  }

  return parseConfig(readFileSync(configPath, 'utf8'));
}

function resolveRuntimeSqliteUrl(configuredUrl: string): string {
  const configuredPath = process.env[SQLITE_PATH_ENV]?.trim();
  if (configuredPath) {
    return toFileUrl(resolveSqlitePath(configuredPath));
  }

  if (configuredUrl.trim()) {
    return toFileUrl(resolveSqlitePath(configuredUrl));
  }

  return resolveDefaultLocalDatabaseUrl();
}

function resolveRuntimeBootstrapConfig(config: BootstrapConfig): BootstrapConfig {
  const externalPostgresDatabase = mergePostgresDatabaseConfig(config.externalPostgresDatabase);
  const externalMysqlDatabase = mergeMysqlDatabaseConfig(config.externalMysqlDatabase);
  const activeProvider = resolveConfiguredProvider(config.activeProvider, externalPostgresDatabase, externalMysqlDatabase);
  assertProductionRelationalDatabaseConfigured(activeProvider);

  return {
    ...config,
    activeProvider,
    localDatabaseUrl: resolveRuntimeSqliteUrl(config.localDatabaseUrl),
    externalPostgresDatabase,
    externalMysqlDatabase,
  };
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

function toMysqlDisplayUrl(config: MysqlExternalDatabaseConfig): string {
  const username = encodeURIComponent(config.username);
  const database = encodeURIComponent(config.database);
  const target = config.instanceConnectionName
    ? `cloudsql(${config.instanceConnectionName};iptype=${config.ipType})`
    : config.socketPath
      ? `unix(${config.socketPath})`
      : `${config.host}:${config.port}`;
  return `mysql://${username}@${target}/${database}?sslmode=${config.sslMode}`;
}

function toMysqlConnectionKey(config: MysqlExternalDatabaseConfig): string {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    socketPath: config.socketPath,
    instanceConnectionName: config.instanceConnectionName,
    ipType: config.ipType,
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
  if (config.activeProvider === 'mysql' && config.externalMysqlDatabase) {
    return {
      provider: 'mysql',
      key: `mysql:${toMysqlConnectionKey(config.externalMysqlDatabase)}`,
      url: toMysqlDisplayUrl(config.externalMysqlDatabase),
      config: config.externalMysqlDatabase,
    };
  }

  if (config.activeProvider === 'postgres' && config.externalPostgresDatabase) {
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
    throw new Error('Postgres port must be an integer between 1 and 65535.');
  }

  return normalizedValue;
}

function normalizePostgresSslMode(value: PostgresSslMode | null | undefined): PostgresSslMode {
  return value === 'disable' ? 'disable' : 'require';
}

function normalizeRequiredDatabaseField(value: string | null | undefined, label: string, maxLength: number): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new Error(`${label} cannot be empty.`);
  }

  if (normalizedValue.length > maxLength) {
    throw new Error(`${label} can be at most ${maxLength} characters.`);
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
    host: normalizeRequiredDatabaseField(input.host, 'Postgres host', 255),
    port: normalizePostgresPort(input.port),
    database: normalizeRequiredDatabaseField(input.database, 'Postgres database name', 128),
    username: normalizeRequiredDatabaseField(input.username, 'Postgres username', 128),
    password: '',
    sslMode: normalizePostgresSslMode(input.sslMode),
  };

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length > 1024) {
    throw new Error('Postgres password can be at most 1024 characters.');
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

function hasMysqlSettingsInput(
  input: UpdateMysqlDatabaseSettingsInput | null | undefined,
): input is UpdateMysqlDatabaseSettingsInput {
  if (!input) {
    return false;
  }

  return [
    input.host,
    input.port,
    input.socketPath,
    input.instanceConnectionName,
    input.ipType,
    input.database,
    input.username,
    input.password,
    input.sslMode,
  ].some((value) => String(value ?? '').trim().length > 0);
}

function normalizeMysqlPort(value: string | number | null | undefined): number {
  const normalizedValue =
    typeof value === 'string'
      ? Number(value.trim() || MYSQL_DEFAULT_PORT)
      : value === null || value === undefined
        ? MYSQL_DEFAULT_PORT
        : Number(value);
  if (!Number.isInteger(normalizedValue) || normalizedValue < 1 || normalizedValue > 65535) {
    throw new Error('MySQL port must be an integer between 1 and 65535.');
  }

  return normalizedValue;
}

function normalizeMysqlSslMode(value: MysqlSslMode | null | undefined): MysqlSslMode {
  return value === 'require' ? 'require' : 'disable';
}

function normalizeOptionalMysqlField(value: string | null | undefined, label: string, maxLength: number): string | null {
  const normalizedValue = value?.trim() || null;
  if (normalizedValue && normalizedValue.length > maxLength) {
    throw new Error(`${label} can be at most ${maxLength} characters.`);
  }

  return normalizedValue;
}

function mysqlIdentityMatches(left: MysqlExternalDatabaseConfig, right: MysqlExternalDatabaseConfig): boolean {
  return (
    left.host === right.host &&
    left.port === right.port &&
    left.socketPath === right.socketPath &&
    left.instanceConnectionName === right.instanceConnectionName &&
    left.ipType === right.ipType &&
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

  const host = normalizeOptionalMysqlField(input.host, 'MySQL host', 255);
  const socketPath = normalizeOptionalMysqlField(input.socketPath, 'MySQL socket path', 1024);
  const instanceConnectionName = normalizeOptionalMysqlField(
    input.instanceConnectionName,
    'MySQL instance connection name',
    255,
  );
  if (!host && !socketPath && !instanceConnectionName) {
    throw new Error('MySQL host, socket path, or instance connection name is required.');
  }

  const nextWithoutPassword: MysqlExternalDatabaseConfig = {
    host,
    port: normalizeMysqlPort(input.port),
    socketPath,
    instanceConnectionName,
    ipType: parseMysqlIpType(input.ipType),
    database: normalizeRequiredDatabaseField(input.database, 'MySQL database name', 128),
    username: normalizeRequiredDatabaseField(input.username, 'MySQL username', 128),
    password: '',
    sslMode: normalizeMysqlSslMode(input.sslMode),
  };

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length > 1024) {
    throw new Error('MySQL password can be at most 1024 characters.');
  }

  return {
    ...nextWithoutPassword,
    password:
      password ||
      (currentConfig.externalMysqlDatabase &&
      mysqlIdentityMatches(nextWithoutPassword, currentConfig.externalMysqlDatabase)
        ? currentConfig.externalMysqlDatabase.password
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

function toMysqlSnapshot(config: MysqlExternalDatabaseConfig | null): MysqlDatabaseSettingsSnapshot | null {
  if (!config) {
    return null;
  }

  return {
    host: config.host,
    port: config.port,
    socketPath: config.socketPath,
    instanceConnectionName: config.instanceConnectionName,
    ipType: config.ipType,
    database: config.database,
    username: config.username,
    sslMode: config.sslMode,
    passwordConfigured: config.password.length > 0,
    configuredFromEnvironment: hasAnyEnv(MYSQL_ENV_KEYS),
  };
}

function testPostgresConnection(config: PostgresExternalDatabaseConfig): void {
  relationalPostgresTestConnection(config);
}

function testMysqlConnection(config: MysqlExternalDatabaseConfig): void {
  relationalMysqlTestConnection(config);
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

    if (activeConnection.target.provider !== 'sqlite') {
      return this.listRelationalPayloads(activeConnection.target, table).map((row) => JSON.parse(row.payload) as T);
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite connection could not be opened.');
    }

    const rows = sqlite
      .prepare('SELECT payload FROM records WHERE table_name = ? ORDER BY rowid ASC')
      .all(table);

    return rows.map((row) => JSON.parse(String(row.payload)) as T);
  }

  insert<T extends { id: string }>(table: TableName, row: T): T {
    if (!row.id?.trim()) {
      throw new Error(`A valid id is required for table "${table}".`);
    }

    const activeConnection = this.database();

    if (activeConnection.target.provider !== 'sqlite') {
      if (activeConnection.target.provider === 'mysql') {
        relationalMysqlInsertRecord(activeConnection.target.config, table, row);
      } else {
        relationalPostgresInsertRecord(activeConnection.target.config, table, row);
      }
      DbService.invalidateSqlReadCache(activeConnection.target.key);
      return row;
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite connection could not be opened.');
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

  insertMany<T extends { id: string }>(table: TableName, rows: T[]): T[] {
    if (rows.length === 0) {
      return [];
    }

    for (const row of rows) {
      if (!row.id?.trim()) {
        throw new Error(`A valid id is required for table "${table}".`);
      }
    }

    const activeConnection = this.database();

    if (activeConnection.target.provider !== 'sqlite') {
      if (activeConnection.target.provider === 'mysql') {
        relationalMysqlInsertRecords(activeConnection.target.config, table, rows);
      } else {
        relationalPostgresInsertRecords(activeConnection.target.config, table, rows);
      }
      DbService.invalidateSqlReadCache(activeConnection.target.key);
      return rows;
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite connection could not be opened.');
    }

    const updatedAt = new Date().toISOString();
    const statement = sqlite.prepare(
      `
        INSERT INTO records (table_name, id, payload, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(table_name, id) DO UPDATE
        SET payload = excluded.payload,
            updated_at = excluded.updated_at
      `,
    );

    sqlite.exec('BEGIN');
    try {
      for (const row of rows) {
        statement.run(table, row.id, JSON.stringify(row), updatedAt);
      }
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }

    return rows;
  }

  findById<T extends { id: string }>(table: TableName, id: string): T | undefined {
    const activeConnection = this.database();
    const row =
      activeConnection.target.provider !== 'sqlite'
        ? this.listRelationalPayloads(activeConnection.target, table).find((record) => record.id === id)
        : (() => {
              const sqlite = activeConnection.sqlite;
              if (!sqlite) {
                throw new Error('SQLite connection could not be opened.');
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

    if (activeConnection.target.provider !== 'sqlite') {
      const deleted =
        activeConnection.target.provider === 'mysql'
          ? relationalMysqlDeleteRecord(activeConnection.target.config, table, id)
          : relationalPostgresDeleteRecord(activeConnection.target.config, table, id);
      if (deleted) {
        DbService.invalidateSqlReadCache(activeConnection.target.key);
      }
      return deleted;
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite connection could not be opened.');
    }

    const result = sqlite
      .prepare('DELETE FROM records WHERE table_name = ? AND id = ?')
      .run(table, id) as { changes?: number | bigint };

    return Number(result.changes ?? 0) > 0;
  }

  getDatabaseSettings(): DatabaseSettingsSnapshot {
    const config = resolveRuntimeBootstrapConfig(readBootstrapConfig());
    const activeTarget = getActiveDatabaseTarget(config);
    const tableCounts = (() => {
      try {
        return this.getTableCounts();
      } catch {
        return createEmptyTableCounts();
      }
    })();

    return {
      defaultSqliteUrl: config.localDatabaseUrl,
      activeProvider: activeTarget.provider,
      activeDatabaseUrl: activeTarget.url,
      postgresDatabase: toPostgresSnapshot(config.externalPostgresDatabase),
      mysqlDatabase: toMysqlSnapshot(config.externalMysqlDatabase),
      isUsingExternalDatabase: activeTarget.provider !== 'sqlite',
      tableCounts,
    };
  }

  updateDatabaseSettings(input: string | UpdateDatabaseSettingsInput | null | undefined): DatabaseSettingsSnapshot {
    const payload = normalizeUpdateInput(input);
    const currentConfig = readBootstrapConfig();
    const now = new Date().toISOString();
    const hasMysqlSettings = hasMysqlSettingsInput(payload.mysql);
    const hasPostgresSettings = hasPostgresSettingsInput(payload.postgres);
    if (hasMysqlSettings && hasPostgresSettings) {
      throw new Error('Send either MySQL or Postgres connection details, not both.');
    }

    if (hasMysqlSettings) {
      const mysqlDatabase = normalizeMysqlDatabaseSettings(payload.mysql, currentConfig);
      if (!mysqlDatabase) {
        throw new Error('MySQL connection details are required.');
      }

      const nextConfig: BootstrapConfig = {
        ...currentConfig,
        activeProvider: 'mysql',
        externalMysqlDatabase: mysqlDatabase,
        updatedAt: now,
      };

      writeBootstrapConfig(nextConfig);
      DbService.closeDatabase();
      initializeRelationalMysqlDatabase(mysqlDatabase);

      return this.getDatabaseSettings();
    }

    const postgresDatabase = normalizePostgresDatabaseSettings(payload.postgres, currentConfig);
    if (!postgresDatabase) {
      throw new Error('Postgres connection details are required.');
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
    const currentConfig = resolveRuntimeBootstrapConfig(readBootstrapConfig());
    const hasMysqlSettings = hasMysqlSettingsInput(payload.mysql);
    const hasPostgresSettings = hasPostgresSettingsInput(payload.postgres);
    if (hasMysqlSettings && hasPostgresSettings) {
      return {
        ok: false,
        provider: null,
        message: 'Send either MySQL or Postgres connection details, not both.',
        resolvedDatabaseUrl: null,
      };
    }

    const mysqlDatabase = hasMysqlSettings
      ? normalizeMysqlDatabaseSettings(payload.mysql, currentConfig)
      : currentConfig.activeProvider === 'mysql'
        ? currentConfig.externalMysqlDatabase
        : null;
    if (mysqlDatabase) {
      try {
        testMysqlConnection(mysqlDatabase);
        return {
          ok: true,
          provider: 'mysql',
          message: 'MySQL connection succeeded.',
          resolvedDatabaseUrl: toMysqlDisplayUrl(mysqlDatabase),
        };
      } catch (error) {
        return {
          ok: false,
          provider: 'mysql',
          message: error instanceof Error ? error.message : 'MySQL connection could not be tested.',
          resolvedDatabaseUrl: toMysqlDisplayUrl(mysqlDatabase),
        };
      }
    }

    const postgresDatabase = normalizePostgresDatabaseSettings(payload.postgres, currentConfig);

    if (postgresDatabase) {
      try {
        testPostgresConnection(postgresDatabase);
        return {
          ok: true,
          provider: 'postgres',
          message: 'Postgres connection succeeded.',
          resolvedDatabaseUrl: toPostgresDisplayUrl(postgresDatabase),
        };
      } catch (error) {
        return {
          ok: false,
          provider: 'postgres',
          message: error instanceof Error ? error.message : 'Postgres connection could not be tested.',
          resolvedDatabaseUrl: toPostgresDisplayUrl(postgresDatabase),
        };
      }
    }

    return {
      ok: false,
      provider: null,
      message: 'Enter MySQL or Postgres connection details for the test.',
      resolvedDatabaseUrl: null,
    };
  }

  private getTableCounts(): Record<string, number> {
    const activeConnection = this.database();

    if (activeConnection.target.provider !== 'sqlite') {
      return this.getRelationalTableCounts(activeConnection.target);
    }

    const sqlite = activeConnection.sqlite;
    if (!sqlite) {
      throw new Error('SQLite connection could not be opened.');
    }

    return sqliteCountRows(sqlite);
  }

  private database(): ActiveDatabaseConnection {
    const config = resolveRuntimeBootstrapConfig(readBootstrapConfig());
    const activeTarget = getActiveDatabaseTarget(config);

    if (DbService.activeConnection && targetsEqual(DbService.activeConnection.target, activeTarget)) {
      return DbService.activeConnection;
    }

    DbService.closeDatabase();

    if (activeTarget.provider !== 'sqlite') {
      if (activeTarget.provider === 'mysql') {
        initializeRelationalMysqlDatabase(activeTarget.config);
      } else {
        initializeRelationalPostgresDatabase(activeTarget.config);
      }
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

  private listRelationalPayloads(target: RelationalDatabaseTarget, table: TableName): StoredRecord[] {
    const cache = this.getRelationalReadCache(target);
    if (cache) {
      return cache.recordsByTable.get(table) ?? [];
    }

    return target.provider === 'mysql'
      ? relationalMysqlListPayloads(target.config, table)
      : relationalPostgresListPayloads(target.config, table);
  }

  private getRelationalTableCounts(target: RelationalDatabaseTarget): Record<string, number> {
    const cache = this.getRelationalReadCache(target);
    if (cache) {
      return { ...cache.tableCounts };
    }

    return target.provider === 'mysql'
      ? relationalMysqlCountRows(target.config)
      : relationalPostgresCountRows(target.config);
  }

  private getRelationalReadCache(target: RelationalDatabaseTarget): SqlReadCache | null {
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

    const groupedRecords = groupStoredRecordsByTable(
      target.provider === 'mysql'
        ? relationalMysqlListAllRecords(target.config)
        : relationalPostgresListAllRecords(target.config),
    );
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
