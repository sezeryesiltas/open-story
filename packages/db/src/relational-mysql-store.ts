import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { storyPlatformTableNames, type StoryPlatformTableName } from '../../contracts/src/persistence.ts';
import { parseRelationalPostgresStringArray } from './relational-postgres-store.ts';

export type RelationalMysqlConfig = {
  host: string | null;
  port: number;
  socketPath: string | null;
  instanceConnectionName: string | null;
  ipType: 'PUBLIC' | 'PRIVATE' | 'PSC';
  database: string;
  username: string;
  password: string;
  sslMode: 'disable' | 'require';
};

type MysqlStatement = {
  sql: string;
  params?: unknown[];
};

type StoredRecord = {
  tableName: StoryPlatformTableName;
  id: string;
  payload: string;
  updatedAt: string;
};

type MysqlRecordValues = {
  columns: string[];
  params: unknown[];
};

const MYSQL_RUNNER_PATH = fileURLToPath(new URL('./mysql-query-runner.mjs', import.meta.url));
const MYSQL_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const RELATIONAL_MIGRATION_ID = '0001_relational_story_platform_mysql';
const MYSQL_TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const RELATIONAL_SCHEMA_STATEMENTS: MysqlStatement[] = [
  {
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(128) PRIMARY KEY,
        applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS client (
        id CHAR(36) PRIMARY KEY,
        client_id VARCHAR(255) NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS admin_user (
        id CHAR(36) PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        role ENUM('super_admin', 'story_admin', 'story_editor') NOT NULL DEFAULT 'super_admin',
        password_hash TEXT NOT NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS admin_session (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        issued_at DATETIME(3) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3),
        CONSTRAINT admin_session_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES admin_user(id) ON DELETE CASCADE
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS static_token (
        id CHAR(36) PRIMARY KEY,
        client_id CHAR(36) NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        token_prefix VARCHAR(255) NOT NULL,
        label TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        revoked_at DATETIME(3),
        expires_at DATETIME(3),
        last_used_at DATETIME(3),
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        KEY idx_static_token_client_active (client_id, is_active),
        CONSTRAINT static_token_client_id_fkey
          FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE RESTRICT,
        CONSTRAINT static_token_revoked_implies_inactive
          CHECK ((revoked_at IS NULL) OR (is_active = FALSE))
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS admin_api_key (
        id CHAR(36) PRIMARY KEY,
        client_name TEXT NOT NULL,
        key_prefix VARCHAR(255) NOT NULL,
        client_secret_hash TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        revoked_at DATETIME(3),
        last_used_at DATETIME(3),
        created_by_admin_user_id CHAR(36),
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        KEY idx_admin_api_key_active (is_active, created_at),
        CONSTRAINT admin_api_key_created_by_admin_user_id_fkey
          FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_user(id) ON DELETE SET NULL,
        CONSTRAINT admin_api_key_revoked_implies_inactive
          CHECK ((revoked_at IS NULL) OR (is_active = FALSE))
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS placement (
        id CHAR(36) PRIMARY KEY,
        placement_key VARCHAR(255) NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS asset (
        id CHAR(36) PRIMARY KEY,
        kind ENUM('group_logo', 'group_badge_svg', 'story_image', 'story_video', 'story_video_poster') NOT NULL,
        source ENUM('upload', 'url', 'cloud_upload') NOT NULL,
        media_type ENUM('image', 'video') NOT NULL,
        storage_key VARCHAR(1024) CHARACTER SET ascii NOT NULL UNIQUE,
        public_url VARCHAR(2048) CHARACTER SET ascii NOT NULL UNIQUE,
        source_file_name TEXT,
        mime_type VARCHAR(255) NOT NULL,
        bytes BIGINT NOT NULL,
        width INTEGER,
        height INTEGER,
        duration_ms INTEGER,
        checksum_sha256 VARCHAR(255) NOT NULL,
        created_by_admin_user_id CHAR(36),
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        KEY idx_asset_kind_created_at (kind, created_at),
        CONSTRAINT asset_created_by_admin_user_id_fkey
          FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_user(id) ON DELETE SET NULL,
        CONSTRAINT asset_bytes_positive CHECK (bytes > 0),
        CONSTRAINT asset_width_positive CHECK (width IS NULL OR width > 0),
        CONSTRAINT asset_height_positive CHECK (height IS NULL OR height > 0),
        CONSTRAINT asset_duration_positive CHECK (duration_ms IS NULL OR duration_ms > 0)
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_set (
        id CHAR(36) PRIMARY KEY,
        placement_id CHAR(36) NOT NULL,
        name TEXT NOT NULL,
        is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        current_draft_revision_id CHAR(36) NOT NULL,
        current_published_revision_id CHAR(36),
        published_fallback_placement_id CHAR(36)
          GENERATED ALWAYS AS (
            CASE
              WHEN is_fallback = TRUE AND is_archived = FALSE AND current_published_revision_id IS NOT NULL
              THEN placement_id
              ELSE NULL
            END
          ) STORED,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_single_fallback_set_per_placement (published_fallback_placement_id),
        CONSTRAINT story_group_set_placement_id_fkey
          FOREIGN KEY (placement_id) REFERENCES placement(id) ON DELETE RESTRICT
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group (
        id CHAR(36) PRIMARY KEY,
        name TEXT NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        current_draft_revision_id CHAR(36) NOT NULL,
        current_published_revision_id CHAR(36),
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story (
        id CHAR(36) PRIMARY KEY,
        name TEXT NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        current_draft_revision_id CHAR(36) NOT NULL,
        current_published_revision_id CHAR(36),
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_set_revision (
        id CHAR(36) PRIMARY KEY,
        story_group_set_id CHAR(36) NOT NULL,
        revision_no INTEGER NOT NULL,
        name TEXT NOT NULL,
        status ENUM('draft', 'published') NOT NULL,
        target_platforms JSON NOT NULL,
        ios_min_app_version VARCHAR(64),
        android_min_app_version VARCHAR(64),
        target_segments JSON NOT NULL,
        created_by_admin_user_id CHAR(36),
        created_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_story_group_set_revision_no (story_group_set_id, revision_no),
        KEY idx_set_revision_published (story_group_set_id, status, created_at),
        CONSTRAINT story_group_set_revision_set_id_fkey
          FOREIGN KEY (story_group_set_id) REFERENCES story_group_set(id) ON DELETE CASCADE,
        CONSTRAINT story_group_set_revision_created_by_admin_user_id_fkey
          FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_user(id) ON DELETE SET NULL,
        CONSTRAINT story_group_set_revision_no_positive CHECK (revision_no > 0)
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_revision (
        id CHAR(36) PRIMARY KEY,
        story_group_id CHAR(36) NOT NULL,
        revision_no INTEGER NOT NULL,
        name TEXT NOT NULL,
        bottom_label TEXT,
        logo_asset_id CHAR(36) NOT NULL,
        badge_kind ENUM('emoji', 'svg'),
        badge_value TEXT,
        status ENUM('draft', 'published') NOT NULL,
        created_by_admin_user_id CHAR(36),
        created_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_story_group_revision_no (story_group_id, revision_no),
        KEY idx_group_revision_published (story_group_id, status, created_at),
        CONSTRAINT story_group_revision_group_id_fkey
          FOREIGN KEY (story_group_id) REFERENCES story_group(id) ON DELETE CASCADE,
        CONSTRAINT story_group_revision_logo_asset_id_fkey
          FOREIGN KEY (logo_asset_id) REFERENCES asset(id) ON DELETE RESTRICT,
        CONSTRAINT story_group_revision_created_by_admin_user_id_fkey
          FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_user(id) ON DELETE SET NULL,
        CONSTRAINT story_group_revision_no_positive CHECK (revision_no > 0),
        CONSTRAINT story_group_badge_shape CHECK (
          (badge_kind IS NULL AND badge_value IS NULL)
          OR (badge_kind IS NOT NULL AND badge_value IS NOT NULL)
        )
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_revision (
        id CHAR(36) PRIMARY KEY,
        story_id CHAR(36) NOT NULL,
        revision_no INTEGER NOT NULL,
        name TEXT NOT NULL,
        media_type ENUM('image', 'video') NOT NULL,
        media_asset_id CHAR(36) NOT NULL,
        video_poster_asset_id CHAR(36),
        image_duration_ms INTEGER,
        cta_label TEXT,
        cta_type ENUM('url', 'deeplink'),
        cta_value TEXT,
        status ENUM('draft', 'published') NOT NULL,
        created_by_admin_user_id CHAR(36),
        created_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_story_revision_no (story_id, revision_no),
        KEY idx_story_revision_published (story_id, status, created_at),
        CONSTRAINT story_revision_story_id_fkey
          FOREIGN KEY (story_id) REFERENCES story(id) ON DELETE CASCADE,
        CONSTRAINT story_revision_media_asset_id_fkey
          FOREIGN KEY (media_asset_id) REFERENCES asset(id) ON DELETE RESTRICT,
        CONSTRAINT story_revision_video_poster_asset_id_fkey
          FOREIGN KEY (video_poster_asset_id) REFERENCES asset(id) ON DELETE RESTRICT,
        CONSTRAINT story_revision_created_by_admin_user_id_fkey
          FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_user(id) ON DELETE SET NULL,
        CONSTRAINT story_revision_no_positive CHECK (revision_no > 0),
        CONSTRAINT story_revision_image_duration_positive CHECK (image_duration_ms IS NULL OR image_duration_ms > 0),
        CONSTRAINT story_cta_shape CHECK (
          (cta_label IS NULL AND cta_type IS NULL AND cta_value IS NULL)
          OR (cta_label IS NOT NULL AND cta_type IS NOT NULL AND cta_value IS NOT NULL)
        ),
        CONSTRAINT story_media_shape CHECK (
          (media_type = 'image' AND video_poster_asset_id IS NULL)
          OR (media_type = 'video' AND video_poster_asset_id IS NOT NULL)
        )
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_set_revision_group (
        id CHAR(36) PRIMARY KEY,
        story_group_set_revision_id CHAR(36) NOT NULL,
        story_group_id CHAR(36) NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_story_group_set_revision_group (story_group_set_revision_id, story_group_id),
        UNIQUE KEY uq_story_group_set_revision_group_order (story_group_set_revision_id, sort_order),
        CONSTRAINT story_group_set_revision_group_revision_id_fkey
          FOREIGN KEY (story_group_set_revision_id) REFERENCES story_group_set_revision(id) ON DELETE CASCADE,
        CONSTRAINT story_group_set_revision_group_story_group_id_fkey
          FOREIGN KEY (story_group_id) REFERENCES story_group(id) ON DELETE RESTRICT,
        CONSTRAINT story_group_set_revision_group_sort_order_nonnegative CHECK (sort_order >= 0)
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_revision_story (
        id CHAR(36) PRIMARY KEY,
        story_group_revision_id CHAR(36) NOT NULL,
        story_id CHAR(36) NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at DATETIME(3) NOT NULL,
        UNIQUE KEY uq_story_group_revision_story (story_group_revision_id, story_id),
        UNIQUE KEY uq_story_group_revision_story_order (story_group_revision_id, sort_order),
        CONSTRAINT story_group_revision_story_revision_id_fkey
          FOREIGN KEY (story_group_revision_id) REFERENCES story_group_revision(id) ON DELETE CASCADE,
        CONSTRAINT story_group_revision_story_story_id_fkey
          FOREIGN KEY (story_id) REFERENCES story(id) ON DELETE RESTRICT,
        CONSTRAINT story_group_revision_story_sort_order_nonnegative CHECK (sort_order >= 0)
      )
    `,
  },
  {
    sql: 'INSERT IGNORE INTO schema_migrations (id) VALUES (?)',
    params: [RELATIONAL_MIGRATION_ID],
  },
].map((statement) =>
  statement.sql.includes('CREATE TABLE IF NOT EXISTS')
    ? {
        ...statement,
        sql: `${statement.sql}\n      ${MYSQL_TABLE_OPTIONS}`,
      }
    : statement,
);

export function initializeRelationalMysqlDatabase(config: RelationalMysqlConfig): void {
  runMysqlStatements(config, RELATIONAL_SCHEMA_STATEMENTS);
}

export function relationalMysqlTestConnection(config: RelationalMysqlConfig): void {
  runMysqlStatements(config, [{ sql: 'SELECT 1 AS ok' }]);
}

export function relationalMysqlListPayloads(
  config: RelationalMysqlConfig,
  table: StoryPlatformTableName,
): StoredRecord[] {
  const [rows] = runMysqlStatements(config, [{ sql: selectSqlForTable(table) }]);
  return mysqlRows(rows).map((row) => toStoredRecord(table, mapRelationalRowToRecord(table, row)));
}

export function relationalMysqlInsertRecord(
  config: RelationalMysqlConfig,
  table: StoryPlatformTableName,
  row: { id: string; [key: string]: unknown },
): void {
  runMysqlStatements(config, [insertStatementForRecord(table, row)]);
}

export function relationalMysqlInsertRecords(
  config: RelationalMysqlConfig,
  table: StoryPlatformTableName,
  rows: Array<{ id: string; [key: string]: unknown }>,
): void {
  if (rows.length === 0) {
    return;
  }

  runMysqlStatements(config, rows.map((row) => insertStatementForRecord(table, row)));
}

export function relationalMysqlDeleteRecord(
  config: RelationalMysqlConfig,
  table: StoryPlatformTableName,
  id: string,
): boolean {
  const [result] = runMysqlStatements(config, [{ sql: `DELETE FROM ${physicalTableName(table)} WHERE id = ?`, params: [id] }]);
  const header = result as { affectedRows?: number | string } | undefined;
  return Number(header?.affectedRows ?? 0) > 0;
}

export function relationalMysqlCountRows(config: RelationalMysqlConfig): Record<string, number> {
  const counts = Object.fromEntries(storyPlatformTableNames.map((table) => [table, 0]));
  const results = runMysqlStatements(
    config,
    storyPlatformTableNames.map((table) => ({ sql: `SELECT COUNT(*) AS count FROM ${physicalTableName(table)}` })),
  );

  storyPlatformTableNames.forEach((table, index) => {
    counts[table] = Number(mysqlRows(results[index])[0]?.count ?? 0);
  });

  return counts;
}

export function relationalMysqlListAllRecords(config: RelationalMysqlConfig): StoredRecord[] {
  const results = runMysqlStatements(
    config,
    storyPlatformTableNames.map((table) => ({ sql: selectSqlForTable(table) })),
  );

  return storyPlatformTableNames.flatMap((table, index) =>
    mysqlRows(results[index]).map((row) => toStoredRecord(table, mapRelationalRowToRecord(table, row))),
  );
}

function runMysqlStatements(config: RelationalMysqlConfig, statements: MysqlStatement[]): unknown[] {
  const result = spawnSync(process.execPath, [MYSQL_RUNNER_PATH], {
    input: JSON.stringify({ config, statements }),
    encoding: 'utf8',
    maxBuffer: MYSQL_MAX_BUFFER_BYTES,
  });

  if (result.error) {
    throw new Error(`MySQL operation could not be started: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `exit code ${result.status}`).trim();
    throw new Error(`MySQL connection or query failed: ${message}`);
  }

  try {
    const parsed = JSON.parse(result.stdout || '{}') as { results?: unknown[] };
    return parsed.results ?? [];
  } catch (error) {
    throw new Error(error instanceof Error ? `MySQL query result could not be read: ${error.message}` : 'MySQL query result could not be read.');
  }
}

function mysqlRows(result: unknown): Array<Record<string, unknown>> {
  return Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
}

function selectSqlForTable(table: StoryPlatformTableName): string {
  switch (table) {
    case 'clients':
      return 'SELECT id, client_id AS `clientId`, name, is_active AS `isActive`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM client';
    case 'staticTokens':
      return 'SELECT id, client_id AS `clientId`, label, token_hash AS `tokenHash`, token_prefix AS `tokenPrefix`, is_active AS `isActive`, revoked_at AS `revokedAt`, expires_at AS `expiresAt`, last_used_at AS `lastUsedAt`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM static_token';
    case 'adminApiKeys':
      return 'SELECT id, client_name AS `clientName`, key_prefix AS `keyPrefix`, client_secret_hash AS `clientSecretHash`, is_active AS `isActive`, revoked_at AS `revokedAt`, last_used_at AS `lastUsedAt`, created_by_admin_user_id AS `createdByAdminUserId`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM admin_api_key';
    case 'adminUsers':
      return 'SELECT id, email, role, password_hash AS `passwordHash`, must_change_password AS `mustChangePassword`, is_active AS `isActive`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM admin_user';
    case 'adminSessions':
      return 'SELECT id, user_id AS `userId`, issued_at AS `issuedAt`, expires_at AS `expiresAt`, revoked_at AS `revokedAt` FROM admin_session';
    case 'placements':
      return 'SELECT id, placement_key AS `key`, name, description, is_active AS `isActive`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM placement';
    case 'assets':
      return 'SELECT id, kind, source, media_type AS `mediaType`, storage_key AS `storageKey`, public_url AS `publicUrl`, source_file_name AS `sourceFileName`, mime_type AS `mimeType`, bytes AS `sizeBytes`, width, height, duration_ms AS `durationMs`, checksum_sha256 AS `checksumSha256`, created_by_admin_user_id AS `createdByAdminUserId`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM asset';
    case 'storyGroupSets':
      return 'SELECT id, placement_id AS `placementId`, name, is_fallback AS `isFallback`, is_archived AS `isArchived`, current_draft_revision_id AS `currentDraftRevisionId`, current_published_revision_id AS `currentPublishedRevisionId`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM story_group_set';
    case 'storyGroupSetRevisions':
      return 'SELECT id, story_group_set_id AS `storyGroupSetId`, revision_no AS `revisionNumber`, name, status, target_platforms AS `targetPlatformsRaw`, ios_min_app_version AS `iosMinAppVersion`, android_min_app_version AS `androidMinAppVersion`, target_segments AS `userSegments`, created_by_admin_user_id AS `createdByAdminUserId`, created_at AS `createdAt` FROM story_group_set_revision';
    case 'storyGroupSetRevisionGroups':
      return 'SELECT id, story_group_set_revision_id AS `storyGroupSetRevisionId`, story_group_id AS `storyGroupId`, sort_order AS `sortOrder`, created_at AS `createdAt` FROM story_group_set_revision_group';
    case 'storyGroups':
      return 'SELECT id, name, is_archived AS `isArchived`, current_draft_revision_id AS `currentDraftRevisionId`, current_published_revision_id AS `currentPublishedRevisionId`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM story_group';
    case 'storyGroupRevisions':
      return 'SELECT id, story_group_id AS `storyGroupId`, revision_no AS `revisionNumber`, name, bottom_label AS `bottomLabel`, logo_asset_id AS `logoAssetId`, badge_kind AS `badgeKind`, badge_value AS `badgeValue`, status, created_by_admin_user_id AS `createdByAdminUserId`, created_at AS `createdAt` FROM story_group_revision';
    case 'storyGroupRevisionStories':
      return 'SELECT id, story_group_revision_id AS `storyGroupRevisionId`, story_id AS `storyId`, sort_order AS `sortOrder`, created_at AS `createdAt` FROM story_group_revision_story';
    case 'stories':
      return 'SELECT id, name, is_archived AS `isArchived`, current_draft_revision_id AS `currentDraftRevisionId`, current_published_revision_id AS `currentPublishedRevisionId`, created_at AS `createdAt`, updated_at AS `updatedAt` FROM story';
    case 'storyRevisions':
      return 'SELECT id, story_id AS `storyId`, revision_no AS `revisionNumber`, name, media_type AS `mediaType`, media_asset_id AS `assetId`, video_poster_asset_id AS `posterAssetId`, image_duration_ms AS `imageDurationMs`, cta_label AS `ctaLabel`, cta_type AS `ctaType`, cta_value AS `ctaValue`, status, created_by_admin_user_id AS `createdByAdminUserId`, created_at AS `createdAt` FROM story_revision';
  }
}

function physicalTableName(table: StoryPlatformTableName): string {
  switch (table) {
    case 'clients': return 'client';
    case 'staticTokens': return 'static_token';
    case 'adminApiKeys': return 'admin_api_key';
    case 'adminUsers': return 'admin_user';
    case 'adminSessions': return 'admin_session';
    case 'placements': return 'placement';
    case 'assets': return 'asset';
    case 'storyGroupSets': return 'story_group_set';
    case 'storyGroupSetRevisions': return 'story_group_set_revision';
    case 'storyGroupSetRevisionGroups': return 'story_group_set_revision_group';
    case 'storyGroups': return 'story_group';
    case 'storyGroupRevisions': return 'story_group_revision';
    case 'storyGroupRevisionStories': return 'story_group_revision_story';
    case 'stories': return 'story';
    case 'storyRevisions': return 'story_revision';
  }
}

function insertStatementForRecord(table: StoryPlatformTableName, row: Record<string, unknown>): MysqlStatement {
  const values = recordValuesForTable(table, row);
  const columns = values.columns.join(', ');
  const placeholders = values.columns.map(() => '?').join(', ');
  const updates = values.columns.filter((column) => column !== 'id').map((column) => `${column} = VALUES(${column})`).join(', ');

  return {
    sql: `INSERT INTO ${physicalTableName(table)} (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
    params: values.params,
  };
}

function recordValuesForTable(table: StoryPlatformTableName, row: Record<string, unknown>): MysqlRecordValues {
  switch (table) {
    case 'clients':
      return values(['id', 'client_id', 'name', 'is_active', 'created_at', 'updated_at'], [row.id, row.clientId, row.name, row.isActive ?? true, row.createdAt, row.updatedAt]);
    case 'staticTokens':
      return values(['id', 'client_id', 'token_hash', 'token_prefix', 'label', 'is_active', 'revoked_at', 'expires_at', 'last_used_at', 'created_at', 'updated_at'], [row.id, row.clientId, row.tokenHash, row.tokenPrefix, row.label, row.isActive ?? true, row.revokedAt ?? null, row.expiresAt ?? null, row.lastUsedAt ?? null, row.createdAt, row.updatedAt]);
    case 'adminApiKeys':
      return values(['id', 'client_name', 'key_prefix', 'client_secret_hash', 'is_active', 'revoked_at', 'last_used_at', 'created_by_admin_user_id', 'created_at', 'updated_at'], [row.id, row.clientName, row.keyPrefix, row.clientSecretHash, row.isActive ?? true, row.revokedAt ?? null, row.lastUsedAt ?? null, row.createdByAdminUserId ?? null, row.createdAt, row.updatedAt]);
    case 'adminUsers':
      return values(['id', 'email', 'role', 'password_hash', 'must_change_password', 'is_active', 'created_at', 'updated_at'], [row.id, row.email, row.role ?? 'super_admin', row.passwordHash, row.mustChangePassword ?? true, row.isActive ?? true, row.createdAt, row.updatedAt]);
    case 'adminSessions':
      return values(['id', 'user_id', 'issued_at', 'expires_at', 'revoked_at'], [row.id, row.userId, row.issuedAt, row.expiresAt, row.revokedAt ?? null]);
    case 'placements':
      return values(['id', 'placement_key', 'name', 'description', 'is_active', 'created_at', 'updated_at'], [row.id, row.key, row.name, row.description ?? null, row.isActive ?? true, row.createdAt, row.updatedAt]);
    case 'assets':
      return values(['id', 'kind', 'source', 'media_type', 'storage_key', 'public_url', 'source_file_name', 'mime_type', 'bytes', 'width', 'height', 'duration_ms', 'checksum_sha256', 'created_by_admin_user_id', 'created_at', 'updated_at'], [row.id, row.kind, row.source, row.mediaType, row.storageKey, row.publicUrl, row.sourceFileName ?? null, row.mimeType, row.sizeBytes, row.width ?? null, row.height ?? null, row.durationMs ?? null, row.checksumSha256, row.createdByAdminUserId ?? null, row.createdAt, row.updatedAt]);
    case 'storyGroupSets':
      return values(['id', 'placement_id', 'name', 'is_fallback', 'is_archived', 'current_draft_revision_id', 'current_published_revision_id', 'created_at', 'updated_at'], [row.id, row.placementId, row.name, row.isFallback ?? false, row.isArchived ?? false, row.currentDraftRevisionId, row.currentPublishedRevisionId ?? null, row.createdAt, row.updatedAt]);
    case 'storyGroupSetRevisions': {
      const targets = normalizedPlatformTargets(row.platformTargets);
      return values(['id', 'story_group_set_id', 'revision_no', 'name', 'status', 'target_platforms', 'ios_min_app_version', 'android_min_app_version', 'target_segments', 'created_by_admin_user_id', 'created_at'], [row.id, row.storyGroupSetId, row.revisionNumber, row.name, row.status, JSON.stringify(targets.platforms), targets.iosMinAppVersion, targets.androidMinAppVersion, JSON.stringify(row.userSegments ?? []), row.createdByAdminUserId ?? null, row.createdAt]);
    }
    case 'storyGroupSetRevisionGroups':
      return values(['id', 'story_group_set_revision_id', 'story_group_id', 'sort_order', 'created_at'], [row.id, row.storyGroupSetRevisionId, row.storyGroupId, row.sortOrder, row.createdAt]);
    case 'storyGroups':
      return values(['id', 'name', 'is_archived', 'current_draft_revision_id', 'current_published_revision_id', 'created_at', 'updated_at'], [row.id, row.name, row.isArchived ?? false, row.currentDraftRevisionId, row.currentPublishedRevisionId ?? null, row.createdAt, row.updatedAt]);
    case 'storyGroupRevisions': {
      const badge = badgeParts(row.badge);
      return values(['id', 'story_group_id', 'revision_no', 'name', 'bottom_label', 'logo_asset_id', 'badge_kind', 'badge_value', 'status', 'created_by_admin_user_id', 'created_at'], [row.id, row.storyGroupId, row.revisionNumber, row.name, row.bottomLabel ?? null, row.logoAssetId, badge.kind, badge.value, row.status, row.createdByAdminUserId ?? null, row.createdAt]);
    }
    case 'storyGroupRevisionStories':
      return values(['id', 'story_group_revision_id', 'story_id', 'sort_order', 'created_at'], [row.id, row.storyGroupRevisionId, row.storyId, row.sortOrder, row.createdAt]);
    case 'stories':
      return values(['id', 'name', 'is_archived', 'current_draft_revision_id', 'current_published_revision_id', 'created_at', 'updated_at'], [row.id, row.name, row.isArchived ?? false, row.currentDraftRevisionId, row.currentPublishedRevisionId ?? null, row.createdAt, row.updatedAt]);
    case 'storyRevisions': {
      const cta = ctaParts(row.cta);
      return values(['id', 'story_id', 'revision_no', 'name', 'media_type', 'media_asset_id', 'video_poster_asset_id', 'image_duration_ms', 'cta_label', 'cta_type', 'cta_value', 'status', 'created_by_admin_user_id', 'created_at'], [row.id, row.storyId, row.revisionNumber, row.name, row.mediaType, row.assetId, row.posterAssetId ?? null, row.imageDurationMs ?? null, cta.label, cta.type, cta.value, row.status, row.createdByAdminUserId ?? null, row.createdAt]);
    }
  }
}

function values(columns: string[], params: unknown[]): MysqlRecordValues {
  return { columns, params };
}

function mapRelationalRowToRecord(
  table: StoryPlatformTableName,
  rawRow: Record<string, unknown>,
): { id: string; [key: string]: unknown } {
  const row = normalizeMysqlRow(table, rawRow);

  switch (table) {
    case 'storyGroupSetRevisions':
      return {
        id: String(row.id),
        storyGroupSetId: row.storyGroupSetId,
        revisionNumber: Number(row.revisionNumber),
        name: row.name,
        status: row.status,
        platformTargets: platformTargetsFromRow(row),
        userSegments: parseRelationalMysqlStringArray(row.userSegments),
        createdByAdminUserId: row.createdByAdminUserId ?? null,
        createdAt: row.createdAt,
      };
    case 'storyGroupRevisions':
      return {
        id: String(row.id),
        storyGroupId: row.storyGroupId,
        revisionNumber: Number(row.revisionNumber),
        name: row.name,
        bottomLabel: row.bottomLabel ?? null,
        logoAssetId: row.logoAssetId,
        badge: row.badgeKind && row.badgeValue ? { type: row.badgeKind, value: row.badgeValue } : null,
        status: row.status,
        createdByAdminUserId: row.createdByAdminUserId ?? null,
        createdAt: row.createdAt,
      };
    case 'storyRevisions':
      return {
        id: String(row.id),
        storyId: row.storyId,
        revisionNumber: Number(row.revisionNumber),
        name: row.name,
        mediaType: row.mediaType,
        assetId: row.assetId,
        posterAssetId: row.posterAssetId ?? null,
        imageDurationMs: row.imageDurationMs === null || row.imageDurationMs === undefined ? null : Number(row.imageDurationMs),
        cta: row.ctaLabel && row.ctaType && row.ctaValue
          ? { label: row.ctaLabel, type: row.ctaType, value: row.ctaValue }
          : null,
        status: row.status,
        createdByAdminUserId: row.createdByAdminUserId ?? null,
        createdAt: row.createdAt,
      };
    case 'assets':
      return {
        ...row,
        id: String(row.id),
        sizeBytes: Number(row.sizeBytes),
        width: row.width === null || row.width === undefined ? null : Number(row.width),
        height: row.height === null || row.height === undefined ? null : Number(row.height),
        durationMs: row.durationMs === null || row.durationMs === undefined ? null : Number(row.durationMs),
        createdByAdminUserId: row.createdByAdminUserId ?? null,
      };
    case 'storyGroupSetRevisionGroups':
    case 'storyGroupRevisionStories':
      return {
        ...row,
        id: String(row.id),
        sortOrder: Number(row.sortOrder),
      };
    default:
      return {
        ...row,
        id: String(row.id),
      };
  }
}

function normalizeMysqlRow(table: StoryPlatformTableName, row: Record<string, unknown>): Record<string, unknown> {
  const booleanFields: Partial<Record<StoryPlatformTableName, string[]>> = {
    clients: ['isActive'],
    staticTokens: ['isActive'],
    adminApiKeys: ['isActive'],
    adminUsers: ['mustChangePassword', 'isActive'],
    placements: ['isActive'],
    storyGroupSets: ['isFallback', 'isArchived'],
    storyGroups: ['isArchived'],
    stories: ['isArchived'],
  };
  const normalized = { ...row };

  for (const field of booleanFields[table] ?? []) {
    normalized[field] = Boolean(row[field]);
  }

  return normalized;
}

function toStoredRecord(tableName: StoryPlatformTableName, row: { id: string; [key: string]: unknown }): StoredRecord {
  return {
    tableName,
    id: row.id,
    payload: JSON.stringify(row),
    updatedAt: String(row.updatedAt ?? row.createdAt ?? ''),
  };
}

function normalizedPlatformTargets(value: unknown): {
  platforms: string[];
  iosMinAppVersion: string | null;
  androidMinAppVersion: string | null;
} {
  const targets = Array.isArray(value) ? value : [];
  const platforms: string[] = [];
  let iosMinAppVersion: string | null = null;
  let androidMinAppVersion: string | null = null;

  for (const target of targets) {
    if (!target || typeof target !== 'object') {
      continue;
    }

    const record = target as Record<string, unknown>;
    const platform = String(record.platform ?? '');
    const minAppVersion = String(record.minAppVersion ?? '');
    if (platform !== 'ios' && platform !== 'android') {
      continue;
    }

    platforms.push(platform);
    if (platform === 'ios') {
      iosMinAppVersion = minAppVersion;
    } else {
      androidMinAppVersion = minAppVersion;
    }
  }

  return { platforms, iosMinAppVersion, androidMinAppVersion };
}

function platformTargetsFromRow(row: Record<string, unknown>): Array<{ platform: 'ios' | 'android'; minAppVersion: string }> {
  const platforms = parseRelationalMysqlStringArray(row.targetPlatformsRaw);
  const targets: Array<{ platform: 'ios' | 'android'; minAppVersion: string }> = [];

  if (platforms.includes('ios') && row.iosMinAppVersion) {
    targets.push({ platform: 'ios', minAppVersion: String(row.iosMinAppVersion) });
  }
  if (platforms.includes('android') && row.androidMinAppVersion) {
    targets.push({ platform: 'android', minAppVersion: String(row.androidMinAppVersion) });
  }

  return targets;
}

export function parseRelationalMysqlStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry));
    }
  } catch {
    // Existing migrated rows may still use PostgreSQL array literal text.
  }

  return parseRelationalPostgresStringArray(value);
}

function badgeParts(value: unknown): { kind: string | null; value: string | null } {
  if (!value || typeof value !== 'object') {
    return { kind: null, value: null };
  }

  const record = value as Record<string, unknown>;
  const kind = String(record.type ?? '');
  if (kind !== 'emoji' && kind !== 'svg') {
    return { kind: null, value: null };
  }

  return { kind, value: String(record.value ?? '') };
}

function ctaParts(value: unknown): { label: string | null; type: string | null; value: string | null } {
  if (!value || typeof value !== 'object') {
    return { label: null, type: null, value: null };
  }

  const record = value as Record<string, unknown>;
  return {
    label: String(record.label ?? ''),
    type: String(record.type ?? ''),
    value: String(record.value ?? ''),
  };
}
