-- Story Bar Platform v1 initial schema (PostgreSQL)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Core enums
-- ------------------------------------------------------------
CREATE TYPE platform_type AS ENUM ('ios', 'android');
CREATE TYPE media_type AS ENUM ('image', 'video');
CREATE TYPE cta_type AS ENUM ('url', 'deeplink');
CREATE TYPE asset_kind AS ENUM ('group_logo', 'group_badge_svg', 'story_image', 'story_video', 'story_video_poster');
CREATE TYPE asset_source AS ENUM ('upload', 'url', 'cloud_upload');
CREATE TYPE badge_kind AS ENUM ('emoji', 'svg');

-- ------------------------------------------------------------
-- Tenant/auth primitives
-- ------------------------------------------------------------
CREATE TABLE client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE static_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT static_token_revoked_implies_inactive CHECK ((revoked_at IS NULL) OR (is_active = FALSE))
);

CREATE INDEX idx_static_token_client_active ON static_token (client_id, is_active);

CREATE TABLE admin_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_api_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  client_secret_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_api_key_revoked_implies_inactive CHECK ((revoked_at IS NULL) OR (is_active = FALSE))
);

CREATE INDEX idx_admin_api_key_active ON admin_api_key (is_active, created_at DESC);

CREATE TABLE placement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_kind_created_at ON asset (kind, created_at DESC);

-- ------------------------------------------------------------
-- StoryGroupSet root/revision
-- ------------------------------------------------------------
CREATE TABLE story_group_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL REFERENCES placement(id) ON DELETE RESTRICT,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  current_draft_revision_id UUID,
  current_published_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (placement_id, key)
);

CREATE TABLE story_group_set_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_group_set_id UUID NOT NULL REFERENCES story_group_set(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  -- targeting
  target_platforms platform_type[] NOT NULL DEFAULT '{}',
  ios_min_app_version TEXT,
  android_min_app_version TEXT,
  target_segments TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_group_set_id, revision_no),
  UNIQUE (story_group_set_id, id)
);

ALTER TABLE story_group_set
  ADD CONSTRAINT fk_set_current_draft_same_root
  FOREIGN KEY (id, current_draft_revision_id)
  REFERENCES story_group_set_revision(story_group_set_id, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE story_group_set
  ADD CONSTRAINT fk_set_current_published_same_root
  FOREIGN KEY (id, current_published_revision_id)
  REFERENCES story_group_set_revision(story_group_set_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX uq_single_fallback_set_per_placement
  ON story_group_set (placement_id)
  WHERE is_fallback = TRUE AND is_archived = FALSE;

-- ------------------------------------------------------------
-- StoryGroup root/revision
-- ------------------------------------------------------------
CREATE TABLE story_group (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  current_draft_revision_id UUID,
  current_published_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE story_group_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_group_id UUID NOT NULL REFERENCES story_group(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  title TEXT NOT NULL,
  logo_asset_id UUID NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
  badge_kind badge_kind,
  badge_emoji TEXT,
  badge_svg_asset_id UUID REFERENCES asset(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_group_id, revision_no),
  UNIQUE (story_group_id, id),
  CONSTRAINT story_group_badge_shape CHECK (
    (badge_kind IS NULL AND badge_emoji IS NULL AND badge_svg_asset_id IS NULL)
    OR (badge_kind = 'emoji' AND badge_emoji IS NOT NULL AND badge_svg_asset_id IS NULL)
    OR (badge_kind = 'svg' AND badge_emoji IS NULL AND badge_svg_asset_id IS NOT NULL)
  )
);

ALTER TABLE story_group
  ADD CONSTRAINT fk_group_current_draft_same_root
  FOREIGN KEY (id, current_draft_revision_id)
  REFERENCES story_group_revision(story_group_id, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE story_group
  ADD CONSTRAINT fk_group_current_published_same_root
  FOREIGN KEY (id, current_published_revision_id)
  REFERENCES story_group_revision(story_group_id, id)
  DEFERRABLE INITIALLY DEFERRED;

-- ------------------------------------------------------------
-- Story root/revision
-- ------------------------------------------------------------
CREATE TABLE story (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  current_draft_revision_id UUID,
  current_published_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE story_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  title TEXT NOT NULL,
  media_type media_type NOT NULL,
  media_asset_id UUID NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
  video_poster_asset_id UUID REFERENCES asset(id) ON DELETE RESTRICT,
  image_duration_ms INTEGER CHECK (image_duration_ms IS NULL OR image_duration_ms > 0),
  cta_label TEXT,
  cta_type cta_type,
  cta_value TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by_admin_user_id UUID REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, revision_no),
  UNIQUE (story_id, id),
  CONSTRAINT story_cta_shape CHECK (
    (cta_label IS NULL AND cta_type IS NULL AND cta_value IS NULL)
    OR (cta_label IS NOT NULL AND cta_type IS NOT NULL AND cta_value IS NOT NULL)
  ),
  CONSTRAINT story_media_shape CHECK (
    (media_type = 'image' AND video_poster_asset_id IS NULL)
    OR (media_type = 'video' AND video_poster_asset_id IS NOT NULL)
  )
);

ALTER TABLE story
  ADD CONSTRAINT fk_story_current_draft_same_root
  FOREIGN KEY (id, current_draft_revision_id)
  REFERENCES story_revision(story_id, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE story
  ADD CONSTRAINT fk_story_current_published_same_root
  FOREIGN KEY (id, current_published_revision_id)
  REFERENCES story_revision(story_id, id)
  DEFERRABLE INITIALLY DEFERRED;

-- ------------------------------------------------------------
-- Revision-aware composition & ordering
-- ------------------------------------------------------------
-- Set composition belongs to StoryGroupSet revision, points to StoryGroup root.
CREATE TABLE story_group_set_revision_group (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_group_set_revision_id UUID NOT NULL REFERENCES story_group_set_revision(id) ON DELETE CASCADE,
  story_group_id UUID NOT NULL REFERENCES story_group(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_group_set_revision_id, story_group_id),
  UNIQUE (story_group_set_revision_id, sort_order)
);

-- Group composition belongs to StoryGroup revision, points to Story root.
CREATE TABLE story_group_revision_story (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_group_revision_id UUID NOT NULL REFERENCES story_group_revision(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES story(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_group_revision_id, story_id),
  UNIQUE (story_group_revision_id, sort_order)
);

-- ------------------------------------------------------------
-- Publish/archive safety indexes & constraints
-- ------------------------------------------------------------
CREATE INDEX idx_story_group_set_not_archived ON story_group_set (id) WHERE is_archived = FALSE;
CREATE INDEX idx_story_group_not_archived ON story_group (id) WHERE is_archived = FALSE;
CREATE INDEX idx_story_not_archived ON story (id) WHERE is_archived = FALSE;

CREATE INDEX idx_set_revision_published ON story_group_set_revision (story_group_set_id, created_at DESC)
  WHERE status = 'published';
CREATE INDEX idx_group_revision_published ON story_group_revision (story_group_id, created_at DESC)
  WHERE status = 'published';
CREATE INDEX idx_story_revision_published ON story_revision (story_id, created_at DESC)
  WHERE status = 'published';

ALTER TABLE story_group_set
  ADD CONSTRAINT archived_set_cannot_point_published
  CHECK (NOT is_archived OR current_published_revision_id IS NULL);

ALTER TABLE story_group
  ADD CONSTRAINT archived_group_cannot_point_published
  CHECK (NOT is_archived OR current_published_revision_id IS NULL);

ALTER TABLE story
  ADD CONSTRAINT archived_story_cannot_point_published
  CHECK (NOT is_archived OR current_published_revision_id IS NULL);

COMMIT;
