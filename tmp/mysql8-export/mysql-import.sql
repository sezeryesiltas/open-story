-- Generated MySQL 8 import helper
USE `story`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/admin_api_key.csv'
INTO TABLE `admin_api_key`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @client_name, @key_prefix, @client_secret_hash, @is_active, @revoked_at, @last_used_at, @created_by_admin_user_id, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `client_name` = NULLIF(@client_name, ''),
  `key_prefix` = NULLIF(@key_prefix, ''),
  `client_secret_hash` = NULLIF(@client_secret_hash, ''),
  `is_active` = NULLIF(@is_active, ''),
  `revoked_at` = NULLIF(@revoked_at, ''),
  `last_used_at` = NULLIF(@last_used_at, ''),
  `created_by_admin_user_id` = NULLIF(@created_by_admin_user_id, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/admin_session.csv'
INTO TABLE `admin_session`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @user_id, @issued_at, @expires_at, @revoked_at)
SET
  `id` = NULLIF(@id, ''),
  `user_id` = NULLIF(@user_id, ''),
  `issued_at` = NULLIF(@issued_at, ''),
  `expires_at` = NULLIF(@expires_at, ''),
  `revoked_at` = NULLIF(@revoked_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/admin_user.csv'
INTO TABLE `admin_user`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @email, @role, @password_hash, @must_change_password, @is_active, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `email` = NULLIF(@email, ''),
  `role` = NULLIF(@role, ''),
  `password_hash` = NULLIF(@password_hash, ''),
  `must_change_password` = NULLIF(@must_change_password, ''),
  `is_active` = NULLIF(@is_active, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/asset.csv'
INTO TABLE `asset`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @kind, @source, @media_type, @storage_key, @public_url, @source_file_name, @mime_type, @bytes, @width, @height, @duration_ms, @checksum_sha256, @created_by_admin_user_id, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `kind` = NULLIF(@kind, ''),
  `source` = NULLIF(@source, ''),
  `media_type` = NULLIF(@media_type, ''),
  `storage_key` = NULLIF(@storage_key, ''),
  `public_url` = NULLIF(@public_url, ''),
  `source_file_name` = NULLIF(@source_file_name, ''),
  `mime_type` = NULLIF(@mime_type, ''),
  `bytes` = NULLIF(@bytes, ''),
  `width` = NULLIF(@width, ''),
  `height` = NULLIF(@height, ''),
  `duration_ms` = NULLIF(@duration_ms, ''),
  `checksum_sha256` = NULLIF(@checksum_sha256, ''),
  `created_by_admin_user_id` = NULLIF(@created_by_admin_user_id, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/client.csv'
INTO TABLE `client`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @client_id, @name, @is_active, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `client_id` = NULLIF(@client_id, ''),
  `name` = NULLIF(@name, ''),
  `is_active` = NULLIF(@is_active, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/placement.csv'
INTO TABLE `placement`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @placement_key, @name, @description, @is_active, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `placement_key` = NULLIF(@placement_key, ''),
  `name` = NULLIF(@name, ''),
  `description` = NULLIF(@description, ''),
  `is_active` = NULLIF(@is_active, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/records.csv'
INTO TABLE `records`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@sequence_id, @table_name, @id, @payload, @updated_at)
SET
  `sequence_id` = NULLIF(@sequence_id, ''),
  `table_name` = NULLIF(@table_name, ''),
  `id` = NULLIF(@id, ''),
  `payload` = NULLIF(@payload, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/schema_migrations.csv'
INTO TABLE `schema_migrations`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @applied_at)
SET
  `id` = NULLIF(@id, ''),
  `applied_at` = NULLIF(@applied_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/static_token.csv'
INTO TABLE `static_token`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @client_id, @token_hash, @token_prefix, @label, @is_active, @revoked_at, @expires_at, @last_used_at, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `client_id` = NULLIF(@client_id, ''),
  `token_hash` = NULLIF(@token_hash, ''),
  `token_prefix` = NULLIF(@token_prefix, ''),
  `label` = NULLIF(@label, ''),
  `is_active` = NULLIF(@is_active, ''),
  `revoked_at` = NULLIF(@revoked_at, ''),
  `expires_at` = NULLIF(@expires_at, ''),
  `last_used_at` = NULLIF(@last_used_at, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story.csv'
INTO TABLE `story`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @name, @is_archived, @current_draft_revision_id, @current_published_revision_id, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `name` = NULLIF(@name, ''),
  `is_archived` = NULLIF(@is_archived, ''),
  `current_draft_revision_id` = NULLIF(@current_draft_revision_id, ''),
  `current_published_revision_id` = NULLIF(@current_published_revision_id, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story_group.csv'
INTO TABLE `story_group`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @name, @is_archived, @current_draft_revision_id, @current_published_revision_id, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `name` = NULLIF(@name, ''),
  `is_archived` = NULLIF(@is_archived, ''),
  `current_draft_revision_id` = NULLIF(@current_draft_revision_id, ''),
  `current_published_revision_id` = NULLIF(@current_published_revision_id, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story_group_revision.csv'
INTO TABLE `story_group_revision`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @story_group_id, @revision_no, @name, @bottom_label, @logo_asset_id, @badge_kind, @badge_value, @status, @created_by_admin_user_id, @created_at)
SET
  `id` = NULLIF(@id, ''),
  `story_group_id` = NULLIF(@story_group_id, ''),
  `revision_no` = NULLIF(@revision_no, ''),
  `name` = NULLIF(@name, ''),
  `bottom_label` = NULLIF(@bottom_label, ''),
  `logo_asset_id` = NULLIF(@logo_asset_id, ''),
  `badge_kind` = NULLIF(@badge_kind, ''),
  `badge_value` = NULLIF(@badge_value, ''),
  `status` = NULLIF(@status, ''),
  `created_by_admin_user_id` = NULLIF(@created_by_admin_user_id, ''),
  `created_at` = NULLIF(@created_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story_group_revision_story.csv'
INTO TABLE `story_group_revision_story`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @story_group_revision_id, @story_id, @sort_order, @created_at)
SET
  `id` = NULLIF(@id, ''),
  `story_group_revision_id` = NULLIF(@story_group_revision_id, ''),
  `story_id` = NULLIF(@story_id, ''),
  `sort_order` = NULLIF(@sort_order, ''),
  `created_at` = NULLIF(@created_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story_group_set.csv'
INTO TABLE `story_group_set`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @placement_id, @name, @is_fallback, @is_archived, @current_draft_revision_id, @current_published_revision_id, @created_at, @updated_at)
SET
  `id` = NULLIF(@id, ''),
  `placement_id` = NULLIF(@placement_id, ''),
  `name` = NULLIF(@name, ''),
  `is_fallback` = NULLIF(@is_fallback, ''),
  `is_archived` = NULLIF(@is_archived, ''),
  `current_draft_revision_id` = NULLIF(@current_draft_revision_id, ''),
  `current_published_revision_id` = NULLIF(@current_published_revision_id, ''),
  `created_at` = NULLIF(@created_at, ''),
  `updated_at` = NULLIF(@updated_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story_group_set_revision.csv'
INTO TABLE `story_group_set_revision`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @story_group_set_id, @revision_no, @name, @status, @target_platforms, @ios_min_app_version, @android_min_app_version, @target_segments, @created_by_admin_user_id, @created_at)
SET
  `id` = NULLIF(@id, ''),
  `story_group_set_id` = NULLIF(@story_group_set_id, ''),
  `revision_no` = NULLIF(@revision_no, ''),
  `name` = NULLIF(@name, ''),
  `status` = NULLIF(@status, ''),
  `target_platforms` = NULLIF(@target_platforms, ''),
  `ios_min_app_version` = NULLIF(@ios_min_app_version, ''),
  `android_min_app_version` = NULLIF(@android_min_app_version, ''),
  `target_segments` = NULLIF(@target_segments, ''),
  `created_by_admin_user_id` = NULLIF(@created_by_admin_user_id, ''),
  `created_at` = NULLIF(@created_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story_group_set_revision_group.csv'
INTO TABLE `story_group_set_revision_group`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @story_group_set_revision_id, @story_group_id, @sort_order, @created_at)
SET
  `id` = NULLIF(@id, ''),
  `story_group_set_revision_id` = NULLIF(@story_group_set_revision_id, ''),
  `story_group_id` = NULLIF(@story_group_id, ''),
  `sort_order` = NULLIF(@sort_order, ''),
  `created_at` = NULLIF(@created_at, '');

LOAD DATA LOCAL INFILE '/Users/tcsyesiltas/open-story/tmp/mysql8-export/csv/story_revision.csv'
INTO TABLE `story_revision`
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"'
LINES TERMINATED BY '\n' IGNORE 1 LINES
(@id, @story_id, @revision_no, @name, @media_type, @media_asset_id, @video_poster_asset_id, @image_duration_ms, @cta_label, @cta_type, @cta_value, @status, @created_by_admin_user_id, @created_at)
SET
  `id` = NULLIF(@id, ''),
  `story_id` = NULLIF(@story_id, ''),
  `revision_no` = NULLIF(@revision_no, ''),
  `name` = NULLIF(@name, ''),
  `media_type` = NULLIF(@media_type, ''),
  `media_asset_id` = NULLIF(@media_asset_id, ''),
  `video_poster_asset_id` = NULLIF(@video_poster_asset_id, ''),
  `image_duration_ms` = NULLIF(@image_duration_ms, ''),
  `cta_label` = NULLIF(@cta_label, ''),
  `cta_type` = NULLIF(@cta_type, ''),
  `cta_value` = NULLIF(@cta_value, ''),
  `status` = NULLIF(@status, ''),
  `created_by_admin_user_id` = NULLIF(@created_by_admin_user_id, ''),
  `created_at` = NULLIF(@created_at, '');

SET FOREIGN_KEY_CHECKS=1;
