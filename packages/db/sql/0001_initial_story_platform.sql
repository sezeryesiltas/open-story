-- Story Bar Platform v1 relational PostgreSQL schema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE platform_type AS ENUM ('ios', 'android');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('image', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cta_type AS ENUM ('url', 'deeplink');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_kind AS ENUM (
    'group_logo',
    'group_badge_svg',
    'story_image',
    'story_video',
    'story_video_poster'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_source AS ENUM ('upload', 'url', 'cloud_upload');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('super_admin', 'story_admin', 'story_editor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client (
  id UUID PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_user (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role admin_role NOT NULL DEFAULT 'super_admin',
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_session (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

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
);

CREATE INDEX IF NOT EXISTS idx_static_token_client_active
  ON static_token (client_id, is_active);

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
);

CREATE INDEX IF NOT EXISTS idx_admin_api_key_active
  ON admin_api_key (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS placement (
  id UUID PRIMARY KEY,
  placement_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

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
);

CREATE INDEX IF NOT EXISTS idx_asset_kind_created_at
  ON asset (kind, created_at DESC);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_single_fallback_set_per_placement
  ON story_group_set (placement_id)
  WHERE is_fallback = TRUE
    AND is_archived = FALSE
    AND current_published_revision_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS story_group (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  current_draft_revision_id UUID NOT NULL,
  current_published_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS story (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  current_draft_revision_id UUID NOT NULL,
  current_published_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

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
);

CREATE TABLE IF NOT EXISTS story_group_revision (
  id UUID PRIMARY KEY,
  story_group_id UUID NOT NULL REFERENCES story_group(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  name TEXT NOT NULL,
  bottom_label TEXT,
  logo_asset_id UUID NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
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
);

CREATE TABLE IF NOT EXISTS story_revision (
  id UUID PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  name TEXT NOT NULL,
  media_type media_type NOT NULL,
  media_asset_id UUID NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
  video_poster_asset_id UUID REFERENCES asset(id) ON DELETE RESTRICT,
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
);

CREATE TABLE IF NOT EXISTS story_group_set_revision_group (
  id UUID PRIMARY KEY,
  story_group_set_revision_id UUID NOT NULL REFERENCES story_group_set_revision(id) ON DELETE CASCADE,
  story_group_id UUID NOT NULL REFERENCES story_group(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (story_group_set_revision_id, story_group_id),
  UNIQUE (story_group_set_revision_id, sort_order)
);

CREATE TABLE IF NOT EXISTS story_group_revision_story (
  id UUID PRIMARY KEY,
  story_group_revision_id UUID NOT NULL REFERENCES story_group_revision(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES story(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (story_group_revision_id, story_id),
  UNIQUE (story_group_revision_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_set_revision_published
  ON story_group_set_revision (story_group_set_id, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_group_revision_published
  ON story_group_revision (story_group_id, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_story_revision_published
  ON story_revision (story_id, created_at DESC)
  WHERE status = 'published';

INSERT INTO schema_migrations (id)
VALUES ('0001_relational_story_platform')
ON CONFLICT (id) DO NOTHING;

COMMIT;
