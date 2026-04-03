import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storyPlatformTableNames, type StoryPlatformTableName } from '../../contracts/src/persistence.ts';

const require = createRequire(import.meta.url);

export type TableName = StoryPlatformTableName;

type DbRecord = {
  id: string;
  [key: string]: unknown;
};

type BootstrapConfig = {
  version: 1;
  localDatabaseUrl: string;
  externalDatabaseUrl: string | null;
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

export interface DatabaseSettingsSnapshot {
  defaultSqliteUrl: string;
  activeDatabaseUrl: string;
  externalDatabaseUrl: string | null;
  isUsingExternalDatabase: boolean;
  migratedAt: string | null;
  tableCounts: Record<string, number>;
}

const TABLE_NAMES: TableName[] = [...storyPlatformTableNames];

const SQLITE_FILENAME = 'open-story.sqlite';
const CONFIG_FILENAME = 'database-config.json';
const SQLITE_PATH_ENV = 'OPEN_STORY_SQLITE_PATH';
const CONFIG_PATH_ENV = 'OPEN_STORY_DB_CONFIG_PATH';

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
    throw new Error('Bu sürümde sadece sqlite/file tabanlı database URL formatları desteklenir.');
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
    version: 1,
    localDatabaseUrl: toFileUrl(resolveLocalDatabasePath()),
    externalDatabaseUrl: null,
    migratedAt: null,
    updatedAt: now,
  };
}

function parseConfig(rawValue: string): BootstrapConfig {
  const parsed = JSON.parse(rawValue) as Partial<BootstrapConfig>;
  const defaults = createDefaultConfig();

  return {
    version: 1,
    localDatabaseUrl:
      typeof parsed.localDatabaseUrl === 'string' && parsed.localDatabaseUrl.trim()
        ? toFileUrl(resolveSqlitePath(parsed.localDatabaseUrl))
        : defaults.localDatabaseUrl,
    externalDatabaseUrl:
      typeof parsed.externalDatabaseUrl === 'string' && parsed.externalDatabaseUrl.trim()
        ? toFileUrl(resolveSqlitePath(parsed.externalDatabaseUrl))
        : null,
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

function getActiveDatabasePath(config: BootstrapConfig): string {
  return resolveSqlitePath(config.externalDatabaseUrl ?? config.localDatabaseUrl);
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

export class DbService {
  private static activeDatabasePath: string | null = null;
  private static database: SqliteDatabase | null = null;

  list<T>(table: TableName): T[] {
    const rows = this.database()
      .prepare('SELECT payload FROM records WHERE table_name = ? ORDER BY rowid ASC')
      .all(table);

    return rows.map((row) => JSON.parse(String(row.payload)) as T);
  }

  insert<T extends { id: string }>(table: TableName, row: T): T {
    if (!row.id?.trim()) {
      throw new Error(`Table "${table}" için geçerli bir id gereklidir.`);
    }

    this.database()
      .prepare(
        `
          INSERT INTO records (table_name, id, payload, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(table_name, id) DO UPDATE
          SET payload = excluded.payload,
              updated_at = excluded.updated_at
        `,
      )
      .run(table, row.id, JSON.stringify(row), new Date().toISOString());

    return row;
  }

  findById<T extends { id: string }>(table: TableName, id: string): T | undefined {
    const row = this.database()
      .prepare('SELECT payload FROM records WHERE table_name = ? AND id = ?')
      .get(table, id);

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
    const result = this.database()
      .prepare('DELETE FROM records WHERE table_name = ? AND id = ?')
      .run(table, id) as { changes?: number | bigint };

    return Number(result.changes ?? 0) > 0;
  }

  getDatabaseSettings(): DatabaseSettingsSnapshot {
    const config = readBootstrapConfig();
    const activeDatabasePath = getActiveDatabasePath(config);
    const tableCounts = Object.fromEntries(
      TABLE_NAMES.map((table) => [table, this.countRows(table)]),
    );

    return {
      defaultSqliteUrl: config.localDatabaseUrl,
      activeDatabaseUrl: toFileUrl(activeDatabasePath),
      externalDatabaseUrl: config.externalDatabaseUrl,
      isUsingExternalDatabase: Boolean(config.externalDatabaseUrl),
      migratedAt: config.migratedAt,
      tableCounts,
    };
  }

  updateDatabaseSettings(externalDatabaseUrl: string | null | undefined): DatabaseSettingsSnapshot {
    const currentConfig = readBootstrapConfig();
    const now = new Date().toISOString();
    const localDatabasePath = resolveSqlitePath(currentConfig.localDatabaseUrl);
    const currentActiveDatabasePath = getActiveDatabasePath(currentConfig);

    ensureSqliteFile(localDatabasePath);
    this.database();

    const nextConfig: BootstrapConfig = {
      ...currentConfig,
      externalDatabaseUrl: normalizeExternalDatabaseUrl(externalDatabaseUrl, currentConfig.localDatabaseUrl),
      updatedAt: now,
      migratedAt: currentConfig.migratedAt,
    };

    const nextActiveDatabasePath = getActiveDatabasePath(nextConfig);

    if (currentActiveDatabasePath !== nextActiveDatabasePath) {
      DbService.closeDatabase();
      ensureParentDirectory(nextActiveDatabasePath);
      copyFileSync(currentActiveDatabasePath, nextActiveDatabasePath);
      nextConfig.migratedAt = now;
    }

    writeBootstrapConfig(nextConfig);
    DbService.closeDatabase();

    return this.getDatabaseSettings();
  }

  private countRows(table: TableName): number {
    const result = this.database()
      .prepare('SELECT COUNT(*) AS count FROM records WHERE table_name = ?')
      .get(table) as { count?: number } | undefined;

    return result?.count ?? 0;
  }

  private database(): SqliteDatabase {
    const config = readBootstrapConfig();
    const localDatabasePath = resolveSqlitePath(config.localDatabaseUrl);
    const activeDatabasePath = getActiveDatabasePath(config);

    ensureSqliteFile(localDatabasePath);

    if (config.externalDatabaseUrl && !existsSync(activeDatabasePath)) {
      ensureParentDirectory(activeDatabasePath);
      copyFileSync(localDatabasePath, activeDatabasePath);
    }

    if (!DbService.database || DbService.activeDatabasePath !== activeDatabasePath) {
      DbService.closeDatabase();
      DbService.database = openSqliteDatabase(activeDatabasePath);
      DbService.activeDatabasePath = activeDatabasePath;
    }

    return DbService.database;
  }

  private static closeDatabase(): void {
    if (DbService.database) {
      DbService.database.close();
    }

    DbService.database = null;
    DbService.activeDatabasePath = null;
  }
}
