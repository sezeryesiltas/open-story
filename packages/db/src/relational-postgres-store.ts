import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { storyPlatformTableNames, type StoryPlatformTableName } from '../../contracts/src/persistence.ts';

export type RelationalPostgresConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode: 'disable' | 'require';
};

type PostgresStatement = {
  sql: string;
  params?: unknown[];
};

type StoredRecord = {
  tableName: StoryPlatformTableName;
  id: string;
  payload: string;
  updatedAt: string;
};

type LegacyRecordPayload = {
  id: string;
  [key: string]: unknown;
};

type RelationalInitializationOptions = {
  includeFinalConstraints?: boolean;
};

type RepairedRevisionRoot = {
  root: LegacyRecordPayload;
  changed: boolean;
};

const POSTGRES_RUNNER_PATH = fileURLToPath(new URL('./postgres-query-runner.mjs', import.meta.url));
const POSTGRES_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const RELATIONAL_MIGRATION_ID = '0001_relational_story_platform';

const RELATIONAL_SCHEMA_STATEMENTS: PostgresStatement[] = [
  {
    sql: `
      DO $$ BEGIN
        CREATE TYPE platform_type AS ENUM ('ios', 'android');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      DO $$ BEGIN
        CREATE TYPE media_type AS ENUM ('image', 'video');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      DO $$ BEGIN
        CREATE TYPE cta_type AS ENUM ('url', 'deeplink');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      DO $$ BEGIN
        CREATE TYPE asset_kind AS ENUM (
          'group_logo',
          'group_badge_svg',
          'story_image',
          'story_video',
          'story_video_poster'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      DO $$ BEGIN
        CREATE TYPE asset_source AS ENUM ('upload', 'url', 'cloud_upload');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      DO $$ BEGIN
        CREATE TYPE admin_role AS ENUM ('super_admin', 'story_admin', 'story_editor');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS client (
        id UUID PRIMARY KEY,
        client_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS admin_user (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        role admin_role NOT NULL DEFAULT 'super_admin',
        password_hash TEXT NOT NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS admin_session (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
        issued_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS static_token (
        id UUID PRIMARY KEY,
        client_id UUID NOT NULL REFERENCES client(id) ON DELETE RESTRICT,
        token_hash TEXT NOT NULL UNIQUE,
        token_prefix TEXT NOT NULL,
        label TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        revoked_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT static_token_revoked_implies_inactive
          CHECK ((revoked_at IS NULL) OR (is_active = FALSE))
      )
    `,
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_static_token_client_active ON static_token (client_id, is_active)',
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS admin_api_key (
        id UUID PRIMARY KEY,
        client_name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        client_secret_hash TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        revoked_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT admin_api_key_revoked_implies_inactive
          CHECK ((revoked_at IS NULL) OR (is_active = FALSE))
      )
    `,
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_admin_api_key_active ON admin_api_key (is_active, created_at DESC)',
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS placement (
        id UUID PRIMARY KEY,
        placement_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS asset (
        id UUID PRIMARY KEY,
        kind asset_kind NOT NULL,
        source asset_source NOT NULL,
        media_type media_type NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        public_url TEXT NOT NULL UNIQUE,
        source_file_name TEXT,
        mime_type TEXT NOT NULL,
        bytes BIGINT NOT NULL CHECK (bytes > 0),
        width INTEGER CHECK (width IS NULL OR width > 0),
        height INTEGER CHECK (height IS NULL OR height > 0),
        duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms > 0),
        checksum_sha256 TEXT NOT NULL,
        created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_asset_kind_created_at ON asset (kind, created_at DESC)',
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_set (
        id UUID PRIMARY KEY,
        placement_id UUID NOT NULL REFERENCES placement(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        current_draft_revision_id UUID NOT NULL,
        current_published_revision_id UUID,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_single_fallback_set_per_placement
        ON story_group_set (placement_id)
        WHERE is_fallback = TRUE AND is_archived = FALSE
          AND current_published_revision_id IS NOT NULL
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        current_draft_revision_id UUID NOT NULL,
        current_published_revision_id UUID,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        current_draft_revision_id UUID NOT NULL,
        current_published_revision_id UUID,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_set_revision (
        id UUID PRIMARY KEY,
        story_group_set_id UUID NOT NULL REFERENCES story_group_set(id) ON DELETE CASCADE,
        revision_no INTEGER NOT NULL CHECK (revision_no > 0),
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
        target_platforms platform_type[] NOT NULL DEFAULT '{}',
        ios_min_app_version TEXT,
        android_min_app_version TEXT,
        target_segments TEXT[] NOT NULL DEFAULT '{}',
        created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE (story_group_set_id, revision_no)
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_revision (
        id UUID PRIMARY KEY,
        story_group_id UUID NOT NULL REFERENCES story_group(id) ON DELETE CASCADE,
        revision_no INTEGER NOT NULL CHECK (revision_no > 0),
        name TEXT NOT NULL,
        bottom_label TEXT,
        logo_asset_id UUID NOT NULL,
        badge_kind TEXT CHECK (badge_kind IS NULL OR badge_kind IN ('emoji', 'svg')),
        badge_value TEXT,
        status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
        created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE (story_group_id, revision_no),
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
        id UUID PRIMARY KEY,
        story_id UUID NOT NULL REFERENCES story(id) ON DELETE CASCADE,
        revision_no INTEGER NOT NULL CHECK (revision_no > 0),
        name TEXT NOT NULL,
        media_type media_type NOT NULL,
        media_asset_id UUID NOT NULL,
        video_poster_asset_id UUID,
        image_duration_ms INTEGER CHECK (image_duration_ms IS NULL OR image_duration_ms > 0),
        cta_label TEXT,
        cta_type cta_type,
        cta_value TEXT,
        status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
        created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE (story_id, revision_no),
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
        id UUID PRIMARY KEY,
        story_group_set_revision_id UUID NOT NULL REFERENCES story_group_set_revision(id) ON DELETE CASCADE,
        story_group_id UUID NOT NULL REFERENCES story_group(id) ON DELETE RESTRICT,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE (story_group_set_revision_id, story_group_id),
        UNIQUE (story_group_set_revision_id, sort_order)
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS story_group_revision_story (
        id UUID PRIMARY KEY,
        story_group_revision_id UUID NOT NULL REFERENCES story_group_revision(id) ON DELETE CASCADE,
        story_id UUID NOT NULL REFERENCES story(id) ON DELETE RESTRICT,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE (story_group_revision_id, story_id),
        UNIQUE (story_group_revision_id, sort_order)
      )
    `,
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_set_revision_published ON story_group_set_revision (story_group_set_id, created_at DESC) WHERE status = \'published\'',
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_group_revision_published ON story_group_revision (story_group_id, created_at DESC) WHERE status = \'published\'',
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_story_revision_published ON story_revision (story_id, created_at DESC) WHERE status = \'published\'',
  },
  {
    sql: 'INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
    params: [RELATIONAL_MIGRATION_ID],
  },
];

const RELATIONAL_FINAL_CONSTRAINT_STATEMENTS: PostgresStatement[] = [
  {
    sql: `
      DO $$ BEGIN
        ALTER TABLE story_group_revision
          ADD CONSTRAINT story_group_revision_logo_asset_id_fkey
          FOREIGN KEY (logo_asset_id) REFERENCES asset(id) ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      DO $$ BEGIN
        ALTER TABLE story_revision
          ADD CONSTRAINT story_revision_media_asset_id_fkey
          FOREIGN KEY (media_asset_id) REFERENCES asset(id) ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    sql: `
      DO $$ BEGIN
        ALTER TABLE story_revision
          ADD CONSTRAINT story_revision_video_poster_asset_id_fkey
          FOREIGN KEY (video_poster_asset_id) REFERENCES asset(id) ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
];

const RELATIONAL_IMPORT_ORDER: StoryPlatformTableName[] = [
  'clients',
  'adminUsers',
  'adminSessions',
  'staticTokens',
  'adminApiKeys',
  'placements',
  'assets',
  'storyGroupSets',
  'storyGroups',
  'stories',
  'storyGroupSetRevisions',
  'storyGroupRevisions',
  'storyRevisions',
  'storyGroupSetRevisionGroups',
  'storyGroupRevisionStories',
];

export function isRelationalPostgresMode(): boolean {
  return process.env.OPEN_STORY_POSTGRES_STORAGE_MODE?.trim().toLowerCase() === 'relational';
}

export function initializeRelationalPostgresDatabase(
  config: RelationalPostgresConfig,
  options: RelationalInitializationOptions = {},
): void {
  runPostgresStatements(
    config,
    options.includeFinalConstraints === false
      ? RELATIONAL_SCHEMA_STATEMENTS
      : [...RELATIONAL_SCHEMA_STATEMENTS, ...RELATIONAL_FINAL_CONSTRAINT_STATEMENTS],
  );
}

export function relationalPostgresListPayloads(
  config: RelationalPostgresConfig,
  table: StoryPlatformTableName,
): StoredRecord[] {
  const [rows] = runPostgresStatements(config, [{ sql: selectSqlForTable(table) }]);
  return postgresRows(rows).map((row) => toStoredRecord(table, mapRelationalRowToRecord(table, row)));
}

export function relationalPostgresFindPayload(
  config: RelationalPostgresConfig,
  table: StoryPlatformTableName,
  id: string,
): StoredRecord | undefined {
  const [rows] = runPostgresStatements(config, [{ sql: `${selectSqlForTable(table)} WHERE id = $1`, params: [id] }]);
  const row = postgresRows(rows)[0];
  return row ? toStoredRecord(table, mapRelationalRowToRecord(table, row)) : undefined;
}

export function relationalPostgresInsertRecord(
  config: RelationalPostgresConfig,
  table: StoryPlatformTableName,
  row: { id: string; [key: string]: unknown },
): void {
  runPostgresStatements(config, [insertStatementForRecord(table, row)]);
}

export function relationalPostgresDeleteRecord(
  config: RelationalPostgresConfig,
  table: StoryPlatformTableName,
  id: string,
): boolean {
  const [result] = runPostgresStatements(config, [{ sql: deleteSqlForTable(table), params: [id] }]);
  const header = result as { rowCount?: number | string } | undefined;
  return Number(header?.rowCount ?? 0) > 0;
}

export function relationalPostgresCountRows(config: RelationalPostgresConfig): Record<string, number> {
  const counts = Object.fromEntries(storyPlatformTableNames.map((table) => [table, 0]));
  const results = runPostgresStatements(
    config,
    storyPlatformTableNames.map((table) => ({ sql: countSqlForTable(table) })),
  );

  storyPlatformTableNames.forEach((table, index) => {
    counts[table] = Number(postgresRows(results[index])[0]?.count ?? 0);
  });

  return counts;
}

export function relationalPostgresListAllRecords(config: RelationalPostgresConfig): StoredRecord[] {
  const results = runPostgresStatements(
    config,
    storyPlatformTableNames.map((table) => ({ sql: selectSqlForTable(table) })),
  );

  return storyPlatformTableNames.flatMap((table, index) =>
    postgresRows(results[index]).map((row) => toStoredRecord(table, mapRelationalRowToRecord(table, row))),
  );
}

export function relationalPostgresReplaceAllRecords(config: RelationalPostgresConfig, records: StoredRecord[]): void {
  initializeRelationalPostgresDatabase(config, { includeFinalConstraints: false });
  const recordsByTable = buildRelationalImportPlan(records);

  const statements: PostgresStatement[] = [
    { sql: 'BEGIN' },
    ...relationalDeleteStatements(),
    ...RELATIONAL_IMPORT_ORDER.flatMap((table) =>
      (recordsByTable.get(table) ?? []).map((record) =>
        insertStatementForRecord(table, record),
      ),
    ),
    ...RELATIONAL_FINAL_CONSTRAINT_STATEMENTS,
    { sql: 'COMMIT' },
  ];

  try {
    runPostgresStatements(config, statements);
  } catch (error) {
    runPostgresStatements(config, [{ sql: 'ROLLBACK' }]);
    throw error;
  }
}

export function buildRelationalImportPlan(records: StoredRecord[]): Map<StoryPlatformTableName, LegacyRecordPayload[]> {
  const recordsByTable = new Map<StoryPlatformTableName, LegacyRecordPayload[]>(
    storyPlatformTableNames.map((table) => [table, []]),
  );

  for (const record of records) {
    const tableRecords = recordsByTable.get(record.tableName);
    if (!tableRecords) {
      continue;
    }

    tableRecords.push(JSON.parse(record.payload) as LegacyRecordPayload);
  }

  cleanBrokenRevisionAssetReferences(recordsByTable);

  return recordsByTable;
}

function cleanBrokenRevisionAssetReferences(
  recordsByTable: Map<StoryPlatformTableName, LegacyRecordPayload[]>,
): void {
  const assetIds = new Set((recordsByTable.get('assets') ?? []).map((record) => record.id));
  const storyRootIds = new Set((recordsByTable.get('stories') ?? []).map((record) => record.id));
  const groupRootIds = new Set((recordsByTable.get('storyGroups') ?? []).map((record) => record.id));
  const skippedGroupRevisionIds = new Set<string>();
  const skippedStoryRevisionIds = new Set<string>();

  for (const revision of recordsByTable.get('storyGroupRevisions') ?? []) {
    if (
      getStoryGroupRevisionAssetProblem(revision, assetIds)
      || !groupRootIds.has(stringValue(revision.storyGroupId))
    ) {
      skippedGroupRevisionIds.add(revision.id);
    }
  }

  for (const revision of recordsByTable.get('storyRevisions') ?? []) {
    if (
      getStoryRevisionAssetProblem(revision, assetIds)
      || !storyRootIds.has(stringValue(revision.storyId))
    ) {
      skippedStoryRevisionIds.add(revision.id);
    }
  }

  recordsByTable.set(
    'storyGroupRevisions',
    (recordsByTable.get('storyGroupRevisions') ?? []).filter((revision) => !skippedGroupRevisionIds.has(revision.id)),
  );
  recordsByTable.set(
    'storyRevisions',
    (recordsByTable.get('storyRevisions') ?? []).filter((revision) => !skippedStoryRevisionIds.has(revision.id)),
  );

  const validGroupRevisionsByRootId = groupRecordsByRootId(
    recordsByTable.get('storyGroupRevisions') ?? [],
    'storyGroupId',
  );
  const validStoryRevisionsByRootId = groupRecordsByRootId(
    recordsByTable.get('storyRevisions') ?? [],
    'storyId',
  );
  const skippedGroupRootIds = new Set<string>();
  const skippedStoryRootIds = new Set<string>();
  let repairedGroupRoots = 0;
  let repairedStoryRoots = 0;

  const repairedGroupRootsList: LegacyRecordPayload[] = [];
  for (const root of recordsByTable.get('storyGroups') ?? []) {
    const repaired = repairCurrentRevisionPointers(root, validGroupRevisionsByRootId.get(root.id) ?? []);
    if (!repaired) {
      skippedGroupRootIds.add(root.id);
      continue;
    }

    if (repaired.changed) {
      repairedGroupRoots += 1;
    }
    repairedGroupRootsList.push(repaired.root);
  }
  recordsByTable.set('storyGroups', repairedGroupRootsList);

  const repairedStoryRootsList: LegacyRecordPayload[] = [];
  for (const root of recordsByTable.get('stories') ?? []) {
    const repaired = repairCurrentRevisionPointers(root, validStoryRevisionsByRootId.get(root.id) ?? []);
    if (!repaired) {
      skippedStoryRootIds.add(root.id);
      continue;
    }

    if (repaired.changed) {
      repairedStoryRoots += 1;
    }
    repairedStoryRootsList.push(repaired.root);
  }
  recordsByTable.set('stories', repairedStoryRootsList);

  if (skippedGroupRootIds.size > 0) {
    for (const revision of recordsByTable.get('storyGroupRevisions') ?? []) {
      if (skippedGroupRootIds.has(stringValue(revision.storyGroupId))) {
        skippedGroupRevisionIds.add(revision.id);
      }
    }
    recordsByTable.set(
      'storyGroupRevisions',
      (recordsByTable.get('storyGroupRevisions') ?? []).filter(
        (revision) => !skippedGroupRootIds.has(stringValue(revision.storyGroupId)),
      ),
    );
  }

  if (skippedStoryRootIds.size > 0) {
    for (const revision of recordsByTable.get('storyRevisions') ?? []) {
      if (skippedStoryRootIds.has(stringValue(revision.storyId))) {
        skippedStoryRevisionIds.add(revision.id);
      }
    }
    recordsByTable.set(
      'storyRevisions',
      (recordsByTable.get('storyRevisions') ?? []).filter(
        (revision) => !skippedStoryRootIds.has(stringValue(revision.storyId)),
      ),
    );
  }

  const compositionRowCounts = cleanCompositionRows(recordsByTable);

  if (
    skippedGroupRevisionIds.size > 0
    || skippedStoryRevisionIds.size > 0
    || skippedGroupRootIds.size > 0
    || skippedStoryRootIds.size > 0
    || repairedGroupRoots > 0
    || repairedStoryRoots > 0
    || compositionRowCounts.groupSetRows > 0
    || compositionRowCounts.groupStoryRows > 0
  ) {
    process.stderr.write(
      [
        'Relational migration cleaned legacy records with broken revision references.',
        `Skipped story group revisions: ${skippedGroupRevisionIds.size}`,
        `Skipped story revisions: ${skippedStoryRevisionIds.size}`,
        `Skipped story groups: ${skippedGroupRootIds.size}`,
        `Skipped stories: ${skippedStoryRootIds.size}`,
        `Repaired story group current revision pointers: ${repairedGroupRoots}`,
        `Repaired story current revision pointers: ${repairedStoryRoots}`,
        `Skipped set/group composition rows: ${compositionRowCounts.groupSetRows}`,
        `Skipped group/story composition rows: ${compositionRowCounts.groupStoryRows}`,
        '',
      ].join('\n'),
    );
  }
}

function cleanCompositionRows(recordsByTable: Map<StoryPlatformTableName, LegacyRecordPayload[]>): {
  groupSetRows: number;
  groupStoryRows: number;
} {
  const remainingGroupRootIds = new Set((recordsByTable.get('storyGroups') ?? []).map((record) => record.id));
  const remainingStoryRootIds = new Set((recordsByTable.get('stories') ?? []).map((record) => record.id));
  const remainingGroupRevisionIds = new Set(
    (recordsByTable.get('storyGroupRevisions') ?? []).map((record) => record.id),
  );
  const remainingSetRevisionIds = new Set(
    (recordsByTable.get('storyGroupSetRevisions') ?? []).map((record) => record.id),
  );
  const groupSetRows = recordsByTable.get('storyGroupSetRevisionGroups') ?? [];
  const groupStoryRows = recordsByTable.get('storyGroupRevisionStories') ?? [];
  const keptGroupSetRows = groupSetRows.filter(
    (record) =>
      remainingSetRevisionIds.has(stringValue(record.storyGroupSetRevisionId))
      && remainingGroupRootIds.has(stringValue(record.storyGroupId)),
  );
  const keptGroupStoryRows = groupStoryRows.filter(
    (record) =>
      remainingGroupRevisionIds.has(stringValue(record.storyGroupRevisionId))
      && remainingStoryRootIds.has(stringValue(record.storyId)),
  );

  recordsByTable.set('storyGroupSetRevisionGroups', keptGroupSetRows);
  recordsByTable.set('storyGroupRevisionStories', keptGroupStoryRows);

  return {
    groupSetRows: groupSetRows.length - keptGroupSetRows.length,
    groupStoryRows: groupStoryRows.length - keptGroupStoryRows.length,
  };
}

function repairCurrentRevisionPointers(
  root: LegacyRecordPayload,
  validRevisions: LegacyRecordPayload[],
): RepairedRevisionRoot | null {
  if (validRevisions.length === 0) {
    return null;
  }

  const validRevisionIds = new Set(validRevisions.map((revision) => revision.id));
  const currentDraftRevisionId = stringValue(root.currentDraftRevisionId);
  const currentPublishedRevisionId = stringValue(root.currentPublishedRevisionId);
  const selectedDraftRevision =
    revisionWithIdAndStatus(validRevisions, currentDraftRevisionId, 'draft')
    ?? latestRevisionWithStatus(validRevisions, 'draft')
    ?? latestRevision(validRevisions);
  const selectedPublishedRevision =
    revisionWithIdAndStatus(validRevisions, currentPublishedRevisionId, 'published')
    ?? latestRevisionWithStatus(validRevisions, 'published');

  if (!selectedDraftRevision) {
    return null;
  }

  const selectedPublishedRevisionId = selectedPublishedRevision?.id ?? null;
  const currentPublishedRevisionIdAfterCleanup = validRevisionIds.has(currentPublishedRevisionId)
    ? currentPublishedRevisionId
    : null;
  const changed =
    selectedDraftRevision.id !== currentDraftRevisionId
    || selectedPublishedRevisionId !== currentPublishedRevisionIdAfterCleanup;

  return {
    root: {
      ...root,
      currentDraftRevisionId: selectedDraftRevision.id,
      currentPublishedRevisionId: selectedPublishedRevisionId,
    },
    changed,
  };
}

function runPostgresStatements(config: RelationalPostgresConfig, statements: PostgresStatement[]): unknown[] {
  const result = spawnSync(process.execPath, [POSTGRES_RUNNER_PATH], {
    input: JSON.stringify({ config, statements }),
    encoding: 'utf8',
    maxBuffer: POSTGRES_MAX_BUFFER_BYTES,
  });

  if (result.error) {
    throw new Error(`Postgres islemi baslatilamadi: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `exit code ${result.status}`).trim();
    throw new Error(`Postgres baglantisi veya sorgusu basarisiz: ${message}`);
  }

  try {
    const parsed = JSON.parse(result.stdout || '{}') as { results?: unknown[] };
    return parsed.results ?? [];
  } catch (error) {
    throw new Error(error instanceof Error ? `Postgres sorgu sonucu okunamadi: ${error.message}` : 'Postgres sorgu sonucu okunamadi.');
  }
}

function postgresRows(result: unknown): Array<Record<string, unknown>> {
  return Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
}

function groupRecordsByRootId(records: LegacyRecordPayload[], rootKey: string): Map<string, LegacyRecordPayload[]> {
  const recordsByRootId = new Map<string, LegacyRecordPayload[]>();

  for (const record of records) {
    const rootId = stringValue(record[rootKey]);
    if (!rootId) {
      continue;
    }

    const rootRecords = recordsByRootId.get(rootId) ?? [];
    rootRecords.push(record);
    recordsByRootId.set(rootId, rootRecords);
  }

  return recordsByRootId;
}

function revisionWithIdAndStatus(
  revisions: LegacyRecordPayload[],
  revisionId: string,
  status: string,
): LegacyRecordPayload | undefined {
  if (!revisionId) {
    return undefined;
  }

  return revisions.find((revision) => revision.id === revisionId && stringValue(revision.status) === status);
}

function latestRevisionWithStatus(revisions: LegacyRecordPayload[], status: string): LegacyRecordPayload | undefined {
  return latestRevision(revisions.filter((revision) => stringValue(revision.status) === status));
}

function latestRevision(revisions: LegacyRecordPayload[]): LegacyRecordPayload | undefined {
  return [...revisions].sort((left, right) => revisionSortValue(right) - revisionSortValue(left))[0];
}

function revisionSortValue(revision: LegacyRecordPayload): number {
  const revisionNumber = Number(revision.revisionNumber);
  if (Number.isFinite(revisionNumber)) {
    return revisionNumber;
  }

  const createdAt = Date.parse(stringValue(revision.createdAt));
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function getStoryGroupRevisionAssetProblem(revision: LegacyRecordPayload, assetIds: Set<string>): string | null {
  const logoAssetId = stringValue(revision.logoAssetId);
  if (!logoAssetId || !assetIds.has(logoAssetId)) {
    return `references missing logo asset ${logoAssetId || '<empty>'}`;
  }

  return null;
}

function getStoryRevisionAssetProblem(revision: LegacyRecordPayload, assetIds: Set<string>): string | null {
  const assetId = stringValue(revision.assetId);
  if (!assetId || !assetIds.has(assetId)) {
    return `references missing media asset ${assetId || '<empty>'}`;
  }

  const mediaType = stringValue(revision.mediaType);
  const posterAssetId = stringValue(revision.posterAssetId);

  if (mediaType === 'video') {
    if (!posterAssetId) {
      return 'is a video revision without poster asset';
    }

    if (!assetIds.has(posterAssetId)) {
      return `references missing poster asset ${posterAssetId}`;
    }
  }

  if (mediaType === 'image' && posterAssetId) {
    return `is an image revision with unexpected poster asset ${posterAssetId}`;
  }

  return null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function selectSqlForTable(table: StoryPlatformTableName): string {
  switch (table) {
    case 'clients':
      return `
        SELECT id::text AS id, client_id AS "clientId", name, is_active AS "isActive",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM client
      `;
    case 'staticTokens':
      return `
        SELECT id::text AS id, client_id::text AS "clientId", label, token_hash AS "tokenHash",
          token_prefix AS "tokenPrefix", is_active AS "isActive", revoked_at AS "revokedAt",
          expires_at AS "expiresAt", last_used_at AS "lastUsedAt", created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM static_token
      `;
    case 'adminApiKeys':
      return `
        SELECT id::text AS id, client_name AS "clientName", key_prefix AS "keyPrefix",
          client_secret_hash AS "clientSecretHash", is_active AS "isActive",
          revoked_at AS "revokedAt", last_used_at AS "lastUsedAt",
          created_by_admin_user_id::text AS "createdByAdminUserId",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM admin_api_key
      `;
    case 'adminUsers':
      return `
        SELECT id::text AS id, email, role, password_hash AS "passwordHash",
          must_change_password AS "mustChangePassword", is_active AS "isActive",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM admin_user
      `;
    case 'adminSessions':
      return `
        SELECT id::text AS id, user_id::text AS "userId", issued_at AS "issuedAt",
          expires_at AS "expiresAt", revoked_at AS "revokedAt"
        FROM admin_session
      `;
    case 'placements':
      return `
        SELECT id::text AS id, placement_key AS key, name, description, is_active AS "isActive",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM placement
      `;
    case 'assets':
      return `
        SELECT id::text AS id, kind, source, media_type AS "mediaType", storage_key AS "storageKey",
          public_url AS "publicUrl", source_file_name AS "sourceFileName", mime_type AS "mimeType",
          bytes AS "sizeBytes", width, height, duration_ms AS "durationMs",
          checksum_sha256 AS "checksumSha256", created_by_admin_user_id::text AS "createdByAdminUserId",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM asset
      `;
    case 'storyGroupSets':
      return `
        SELECT id::text AS id, placement_id::text AS "placementId", name, is_fallback AS "isFallback",
          is_archived AS "isArchived", current_draft_revision_id::text AS "currentDraftRevisionId",
          current_published_revision_id::text AS "currentPublishedRevisionId",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM story_group_set
      `;
    case 'storyGroupSetRevisions':
      return `
        SELECT id::text AS id, story_group_set_id::text AS "storyGroupSetId", revision_no AS "revisionNumber",
          name, status, target_platforms AS "targetPlatformsRaw", ios_min_app_version AS "iosMinAppVersion",
          android_min_app_version AS "androidMinAppVersion", target_segments AS "userSegments",
          created_by_admin_user_id::text AS "createdByAdminUserId", created_at AS "createdAt"
        FROM story_group_set_revision
      `;
    case 'storyGroupSetRevisionGroups':
      return `
        SELECT id::text AS id, story_group_set_revision_id::text AS "storyGroupSetRevisionId",
          story_group_id::text AS "storyGroupId", sort_order AS "sortOrder", created_at AS "createdAt"
        FROM story_group_set_revision_group
      `;
    case 'storyGroups':
      return `
        SELECT id::text AS id, name, is_archived AS "isArchived",
          current_draft_revision_id::text AS "currentDraftRevisionId",
          current_published_revision_id::text AS "currentPublishedRevisionId",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM story_group
      `;
    case 'storyGroupRevisions':
      return `
        SELECT id::text AS id, story_group_id::text AS "storyGroupId", revision_no AS "revisionNumber",
          name, bottom_label AS "bottomLabel", logo_asset_id::text AS "logoAssetId",
          badge_kind AS "badgeKind", badge_value AS "badgeValue", status,
          created_by_admin_user_id::text AS "createdByAdminUserId", created_at AS "createdAt"
        FROM story_group_revision
      `;
    case 'storyGroupRevisionStories':
      return `
        SELECT id::text AS id, story_group_revision_id::text AS "storyGroupRevisionId",
          story_id::text AS "storyId", sort_order AS "sortOrder", created_at AS "createdAt"
        FROM story_group_revision_story
      `;
    case 'stories':
      return `
        SELECT id::text AS id, name, is_archived AS "isArchived",
          current_draft_revision_id::text AS "currentDraftRevisionId",
          current_published_revision_id::text AS "currentPublishedRevisionId",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM story
      `;
    case 'storyRevisions':
      return `
        SELECT id::text AS id, story_id::text AS "storyId", revision_no AS "revisionNumber",
          name, media_type AS "mediaType", media_asset_id::text AS "assetId",
          video_poster_asset_id::text AS "posterAssetId", image_duration_ms AS "imageDurationMs",
          cta_label AS "ctaLabel", cta_type AS "ctaType", cta_value AS "ctaValue", status,
          created_by_admin_user_id::text AS "createdByAdminUserId", created_at AS "createdAt"
        FROM story_revision
      `;
  }
}

function countSqlForTable(table: StoryPlatformTableName): string {
  return `SELECT COUNT(*) AS count FROM ${physicalTableName(table)}`;
}

function deleteSqlForTable(table: StoryPlatformTableName): string {
  return `DELETE FROM ${physicalTableName(table)} WHERE id = $1`;
}

function physicalTableName(table: StoryPlatformTableName): string {
  switch (table) {
    case 'clients':
      return 'client';
    case 'staticTokens':
      return 'static_token';
    case 'adminApiKeys':
      return 'admin_api_key';
    case 'adminUsers':
      return 'admin_user';
    case 'adminSessions':
      return 'admin_session';
    case 'placements':
      return 'placement';
    case 'assets':
      return 'asset';
    case 'storyGroupSets':
      return 'story_group_set';
    case 'storyGroupSetRevisions':
      return 'story_group_set_revision';
    case 'storyGroupSetRevisionGroups':
      return 'story_group_set_revision_group';
    case 'storyGroups':
      return 'story_group';
    case 'storyGroupRevisions':
      return 'story_group_revision';
    case 'storyGroupRevisionStories':
      return 'story_group_revision_story';
    case 'stories':
      return 'story';
    case 'storyRevisions':
      return 'story_revision';
  }
}

function insertStatementForRecord(table: StoryPlatformTableName, row: Record<string, unknown>): PostgresStatement {
  switch (table) {
    case 'clients':
      return {
        sql: `
          INSERT INTO client (id, client_id, name, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            client_id = EXCLUDED.client_id,
            name = EXCLUDED.name,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [row.id, row.clientId, row.name, row.isActive ?? true, row.createdAt, row.updatedAt],
      };
    case 'staticTokens':
      return {
        sql: `
          INSERT INTO static_token (
            id, client_id, token_hash, token_prefix, label, is_active, revoked_at, expires_at,
            last_used_at, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            client_id = EXCLUDED.client_id,
            token_hash = EXCLUDED.token_hash,
            token_prefix = EXCLUDED.token_prefix,
            label = EXCLUDED.label,
            is_active = EXCLUDED.is_active,
            revoked_at = EXCLUDED.revoked_at,
            expires_at = EXCLUDED.expires_at,
            last_used_at = EXCLUDED.last_used_at,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [
          row.id,
          row.clientId,
          row.tokenHash,
          row.tokenPrefix,
          row.label,
          row.isActive ?? true,
          row.revokedAt ?? null,
          row.expiresAt ?? null,
          row.lastUsedAt ?? null,
          row.createdAt,
          row.updatedAt,
        ],
      };
    case 'adminApiKeys':
      return {
        sql: `
          INSERT INTO admin_api_key (
            id, client_name, key_prefix, client_secret_hash, is_active, revoked_at, last_used_at,
            created_by_admin_user_id, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            client_name = EXCLUDED.client_name,
            key_prefix = EXCLUDED.key_prefix,
            client_secret_hash = EXCLUDED.client_secret_hash,
            is_active = EXCLUDED.is_active,
            revoked_at = EXCLUDED.revoked_at,
            last_used_at = EXCLUDED.last_used_at,
            created_by_admin_user_id = EXCLUDED.created_by_admin_user_id,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [
          row.id,
          row.clientName,
          row.keyPrefix,
          row.clientSecretHash,
          row.isActive ?? true,
          row.revokedAt ?? null,
          row.lastUsedAt ?? null,
          row.createdByAdminUserId ?? null,
          row.createdAt,
          row.updatedAt,
        ],
      };
    case 'adminUsers':
      return {
        sql: `
          INSERT INTO admin_user (
            id, email, role, password_hash, must_change_password, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3::admin_role, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            password_hash = EXCLUDED.password_hash,
            must_change_password = EXCLUDED.must_change_password,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [
          row.id,
          row.email,
          row.role ?? 'super_admin',
          row.passwordHash,
          row.mustChangePassword ?? true,
          row.isActive ?? true,
          row.createdAt,
          row.updatedAt,
        ],
      };
    case 'adminSessions':
      return {
        sql: `
          INSERT INTO admin_session (id, user_id, issued_at, expires_at, revoked_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            issued_at = EXCLUDED.issued_at,
            expires_at = EXCLUDED.expires_at,
            revoked_at = EXCLUDED.revoked_at
        `,
        params: [row.id, row.userId, row.issuedAt, row.expiresAt, row.revokedAt ?? null],
      };
    case 'placements':
      return {
        sql: `
          INSERT INTO placement (id, placement_key, name, description, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            placement_key = EXCLUDED.placement_key,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [row.id, row.key, row.name, row.description ?? null, row.isActive ?? true, row.createdAt, row.updatedAt],
      };
    case 'assets':
      return {
        sql: `
          INSERT INTO asset (
            id, kind, source, media_type, storage_key, public_url, source_file_name, mime_type, bytes,
            width, height, duration_ms, checksum_sha256, created_by_admin_user_id, created_at, updated_at
          )
          VALUES ($1, $2::asset_kind, $3::asset_source, $4::media_type, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            kind = EXCLUDED.kind,
            source = EXCLUDED.source,
            media_type = EXCLUDED.media_type,
            storage_key = EXCLUDED.storage_key,
            public_url = EXCLUDED.public_url,
            source_file_name = EXCLUDED.source_file_name,
            mime_type = EXCLUDED.mime_type,
            bytes = EXCLUDED.bytes,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            duration_ms = EXCLUDED.duration_ms,
            checksum_sha256 = EXCLUDED.checksum_sha256,
            created_by_admin_user_id = EXCLUDED.created_by_admin_user_id,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [
          row.id,
          row.kind,
          row.source,
          row.mediaType,
          row.storageKey,
          row.publicUrl,
          row.sourceFileName ?? null,
          row.mimeType,
          row.sizeBytes,
          row.width ?? null,
          row.height ?? null,
          row.durationMs ?? null,
          row.checksumSha256,
          row.createdByAdminUserId ?? null,
          row.createdAt,
          row.updatedAt,
        ],
      };
    case 'storyGroupSets':
      return {
        sql: `
          INSERT INTO story_group_set (
            id, placement_id, name, is_fallback, is_archived, current_draft_revision_id,
            current_published_revision_id, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            placement_id = EXCLUDED.placement_id,
            name = EXCLUDED.name,
            is_fallback = EXCLUDED.is_fallback,
            is_archived = EXCLUDED.is_archived,
            current_draft_revision_id = EXCLUDED.current_draft_revision_id,
            current_published_revision_id = EXCLUDED.current_published_revision_id,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [
          row.id,
          row.placementId,
          row.name,
          row.isFallback ?? false,
          row.isArchived ?? false,
          row.currentDraftRevisionId,
          row.currentPublishedRevisionId ?? null,
          row.createdAt,
          row.updatedAt,
        ],
      };
    case 'storyGroupSetRevisions': {
      const targets = normalizedPlatformTargets(row.platformTargets);
      return {
        sql: `
          INSERT INTO story_group_set_revision (
            id, story_group_set_id, revision_no, name, status, target_platforms,
            ios_min_app_version, android_min_app_version, target_segments,
            created_by_admin_user_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::platform_type[], $7, $8, $9::text[], $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            story_group_set_id = EXCLUDED.story_group_set_id,
            revision_no = EXCLUDED.revision_no,
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            target_platforms = EXCLUDED.target_platforms,
            ios_min_app_version = EXCLUDED.ios_min_app_version,
            android_min_app_version = EXCLUDED.android_min_app_version,
            target_segments = EXCLUDED.target_segments,
            created_by_admin_user_id = EXCLUDED.created_by_admin_user_id,
            created_at = EXCLUDED.created_at
        `,
        params: [
          row.id,
          row.storyGroupSetId,
          row.revisionNumber,
          row.name,
          row.status,
          targets.platforms,
          targets.iosMinAppVersion,
          targets.androidMinAppVersion,
          row.userSegments ?? [],
          row.createdByAdminUserId ?? null,
          row.createdAt,
        ],
      };
    }
    case 'storyGroupSetRevisionGroups':
      return {
        sql: `
          INSERT INTO story_group_set_revision_group (
            id, story_group_set_revision_id, story_group_id, sort_order, created_at
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            story_group_set_revision_id = EXCLUDED.story_group_set_revision_id,
            story_group_id = EXCLUDED.story_group_id,
            sort_order = EXCLUDED.sort_order,
            created_at = EXCLUDED.created_at
        `,
        params: [row.id, row.storyGroupSetRevisionId, row.storyGroupId, row.sortOrder, row.createdAt],
      };
    case 'storyGroups':
      return {
        sql: `
          INSERT INTO story_group (
            id, name, is_archived, current_draft_revision_id, current_published_revision_id, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            is_archived = EXCLUDED.is_archived,
            current_draft_revision_id = EXCLUDED.current_draft_revision_id,
            current_published_revision_id = EXCLUDED.current_published_revision_id,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [
          row.id,
          row.name,
          row.isArchived ?? false,
          row.currentDraftRevisionId,
          row.currentPublishedRevisionId ?? null,
          row.createdAt,
          row.updatedAt,
        ],
      };
    case 'storyGroupRevisions': {
      const badge = badgeParts(row.badge);
      return {
        sql: `
          INSERT INTO story_group_revision (
            id, story_group_id, revision_no, name, bottom_label, logo_asset_id,
            badge_kind, badge_value, status, created_by_admin_user_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            story_group_id = EXCLUDED.story_group_id,
            revision_no = EXCLUDED.revision_no,
            name = EXCLUDED.name,
            bottom_label = EXCLUDED.bottom_label,
            logo_asset_id = EXCLUDED.logo_asset_id,
            badge_kind = EXCLUDED.badge_kind,
            badge_value = EXCLUDED.badge_value,
            status = EXCLUDED.status,
            created_by_admin_user_id = EXCLUDED.created_by_admin_user_id,
            created_at = EXCLUDED.created_at
        `,
        params: [
          row.id,
          row.storyGroupId,
          row.revisionNumber,
          row.name,
          row.bottomLabel ?? null,
          row.logoAssetId,
          badge.kind,
          badge.value,
          row.status,
          row.createdByAdminUserId ?? null,
          row.createdAt,
        ],
      };
    }
    case 'storyGroupRevisionStories':
      return {
        sql: `
          INSERT INTO story_group_revision_story (
            id, story_group_revision_id, story_id, sort_order, created_at
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            story_group_revision_id = EXCLUDED.story_group_revision_id,
            story_id = EXCLUDED.story_id,
            sort_order = EXCLUDED.sort_order,
            created_at = EXCLUDED.created_at
        `,
        params: [row.id, row.storyGroupRevisionId, row.storyId, row.sortOrder, row.createdAt],
      };
    case 'stories':
      return {
        sql: `
          INSERT INTO story (
            id, name, is_archived, current_draft_revision_id, current_published_revision_id, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            is_archived = EXCLUDED.is_archived,
            current_draft_revision_id = EXCLUDED.current_draft_revision_id,
            current_published_revision_id = EXCLUDED.current_published_revision_id,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        `,
        params: [
          row.id,
          row.name,
          row.isArchived ?? false,
          row.currentDraftRevisionId,
          row.currentPublishedRevisionId ?? null,
          row.createdAt,
          row.updatedAt,
        ],
      };
    case 'storyRevisions': {
      const cta = ctaParts(row.cta);
      return {
        sql: `
          INSERT INTO story_revision (
            id, story_id, revision_no, name, media_type, media_asset_id, video_poster_asset_id,
            image_duration_ms, cta_label, cta_type, cta_value, status, created_by_admin_user_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5::media_type, $6, $7, $8, $9, $10::cta_type, $11, $12, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            story_id = EXCLUDED.story_id,
            revision_no = EXCLUDED.revision_no,
            name = EXCLUDED.name,
            media_type = EXCLUDED.media_type,
            media_asset_id = EXCLUDED.media_asset_id,
            video_poster_asset_id = EXCLUDED.video_poster_asset_id,
            image_duration_ms = EXCLUDED.image_duration_ms,
            cta_label = EXCLUDED.cta_label,
            cta_type = EXCLUDED.cta_type,
            cta_value = EXCLUDED.cta_value,
            status = EXCLUDED.status,
            created_by_admin_user_id = EXCLUDED.created_by_admin_user_id,
            created_at = EXCLUDED.created_at
        `,
        params: [
          row.id,
          row.storyId,
          row.revisionNumber,
          row.name,
          row.mediaType,
          row.assetId,
          row.posterAssetId ?? null,
          row.imageDurationMs ?? null,
          cta.label,
          cta.type,
          cta.value,
          row.status,
          row.createdByAdminUserId ?? null,
          row.createdAt,
        ],
      };
    }
  }
}

function mapRelationalRowToRecord(
  table: StoryPlatformTableName,
  row: Record<string, unknown>,
): { id: string; [key: string]: unknown } {
  switch (table) {
    case 'storyGroupSetRevisions':
      return {
        id: String(row.id),
        storyGroupSetId: row.storyGroupSetId,
        revisionNumber: Number(row.revisionNumber),
        name: row.name,
        status: row.status,
        platformTargets: platformTargetsFromRow(row),
        userSegments: toStringArray(row.userSegments),
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

  return {
    platforms,
    iosMinAppVersion,
    androidMinAppVersion,
  };
}

function platformTargetsFromRow(row: Record<string, unknown>): Array<{ platform: 'ios' | 'android'; minAppVersion: string }> {
  const platforms = toStringArray(row.targetPlatformsRaw);
  const targets: Array<{ platform: 'ios' | 'android'; minAppVersion: string }> = [];

  if (platforms.includes('ios') && row.iosMinAppVersion) {
    targets.push({ platform: 'ios', minAppVersion: String(row.iosMinAppVersion) });
  }

  if (platforms.includes('android') && row.androidMinAppVersion) {
    targets.push({ platform: 'android', minAppVersion: String(row.androidMinAppVersion) });
  }

  return targets;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
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

  return {
    kind,
    value: String(record.value ?? ''),
  };
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

function relationalDeleteStatements(): PostgresStatement[] {
  return [
    { sql: 'DELETE FROM story_group_revision_story' },
    { sql: 'DELETE FROM story_group_set_revision_group' },
    { sql: 'DELETE FROM story_revision' },
    { sql: 'DELETE FROM story_group_revision' },
    { sql: 'DELETE FROM story_group_set_revision' },
    { sql: 'DELETE FROM story' },
    { sql: 'DELETE FROM story_group' },
    { sql: 'DELETE FROM story_group_set' },
    { sql: 'DELETE FROM asset' },
    { sql: 'DELETE FROM placement' },
    { sql: 'DELETE FROM admin_api_key' },
    { sql: 'DELETE FROM static_token' },
    { sql: 'DELETE FROM admin_session' },
    { sql: 'DELETE FROM admin_user' },
    { sql: 'DELETE FROM client' },
  ];
}
