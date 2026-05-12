import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type {
  AssetStorageSettingsDto,
  GcsAssetStorageSettingsDto,
  SupabaseS3AssetStorageSettingsDto,
  UpdateAssetStorageSettingsDto,
} from '@open-story/contracts';

type SupabaseS3AssetStorageConfig = Omit<
  SupabaseS3AssetStorageSettingsDto,
  'secretAccessKeyConfigured'
> & {
  secretAccessKey: string;
};

type AssetStorageConfig = {
  version: 2;
  activeProvider: AssetStorageSettingsDto['activeProvider'];
  gcs: Omit<GcsAssetStorageSettingsDto, 'credentialsSource'>;
  supabaseS3: SupabaseS3AssetStorageConfig;
  updatedAt: string | null;
};

const CONFIG_PATH_ENV = 'OPEN_STORY_ASSET_STORAGE_CONFIG_PATH';
const LOCAL_PUBLIC_BASE_URL_ENV = 'OPEN_STORY_PUBLIC_ASSET_BASE_URL';
const STORAGE_PROVIDER_ENV = 'OPEN_STORY_ASSET_STORAGE_PROVIDER';
const GCS_PROJECT_ID_ENV = 'OPEN_STORY_GCS_PROJECT_ID';
const GCS_BUCKET_ENV = 'OPEN_STORY_GCS_BUCKET';
const GCS_OBJECT_PREFIX_ENV = 'OPEN_STORY_GCS_OBJECT_PREFIX';
const GCS_PUBLIC_BASE_URL_ENV = 'OPEN_STORY_GCS_PUBLIC_ASSET_BASE_URL';
const GCS_CACHE_CONTROL_ENV = 'OPEN_STORY_GCS_CACHE_CONTROL';
const SUPABASE_S3_ENDPOINT_ENV = 'OPEN_STORY_SUPABASE_S3_ENDPOINT';
const SUPABASE_S3_REGION_ENV = 'OPEN_STORY_SUPABASE_S3_REGION';
const SUPABASE_S3_BUCKET_ENV = 'OPEN_STORY_SUPABASE_S3_BUCKET';
const SUPABASE_S3_ACCESS_KEY_ID_ENV = 'OPEN_STORY_SUPABASE_S3_ACCESS_KEY_ID';
const SUPABASE_S3_SECRET_ACCESS_KEY_ENV = 'OPEN_STORY_SUPABASE_S3_SECRET_ACCESS_KEY';
const SUPABASE_S3_OBJECT_PREFIX_ENV = 'OPEN_STORY_SUPABASE_S3_OBJECT_PREFIX';
const SUPABASE_S3_PUBLIC_BASE_URL_ENV = 'OPEN_STORY_SUPABASE_S3_PUBLIC_ASSET_BASE_URL';
const SUPABASE_S3_CACHE_CONTROL_ENV = 'OPEN_STORY_SUPABASE_S3_CACHE_CONTROL';

const DEFAULT_LOCAL_PUBLIC_ASSET_BASE_URL = 'http://localhost:3001/uploads/assets';
const DEFAULT_GCS_OBJECT_PREFIX = 'assets';
const DEFAULT_GCS_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const DEFAULT_SUPABASE_S3_OBJECT_PREFIX = 'assets';
const DEFAULT_SUPABASE_S3_REGION = 'project_region';
const DEFAULT_SUPABASE_S3_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export class AssetStorageSettingsStore {
  getSettings(): AssetStorageSettingsDto {
    const config = resolveRuntimeConfig(readStoredConfig());

    return {
      activeProvider: config.activeProvider,
      localPublicAssetBaseUrl: getLocalPublicAssetBaseUrl(),
      gcs: {
        ...config.gcs,
        credentialsSource: 'application_default_credentials',
      },
      supabaseS3: toSupabaseS3SettingsDto(config.supabaseS3),
      recommendedProductionProvider: 'gcs',
      updatedAt: config.updatedAt,
    };
  }

  updateSettings(input: UpdateAssetStorageSettingsDto): AssetStorageSettingsDto {
    const current = readStoredConfig();
    const next: AssetStorageConfig = {
      ...current,
      activeProvider: normalizeProvider(input.activeProvider ?? current.activeProvider),
      gcs: normalizeGcsSettings(input.gcs, current.gcs),
      supabaseS3: normalizeSupabaseS3Settings(input.supabaseS3, current.supabaseS3),
      updatedAt: new Date().toISOString(),
    };

    if (next.activeProvider === 'gcs') {
      assertUsableGcsSettings(next.gcs);
    } else if (next.activeProvider === 'supabase_s3') {
      assertUsableSupabaseS3Settings(next.supabaseS3);
    }

    writeConfig(next);
    return this.getSettings();
  }

  normalizeCandidate(input: UpdateAssetStorageSettingsDto): AssetStorageSettingsDto {
    return this.normalizeCandidateForConnection(input).settings;
  }

  normalizeCandidateForConnection(input: UpdateAssetStorageSettingsDto): {
    settings: AssetStorageSettingsDto;
    supabaseS3SecretAccessKey: string | null;
  } {
    const current = resolveRuntimeConfig(readStoredConfig());
    const activeProvider = normalizeProvider(input.activeProvider ?? current.activeProvider);
    const gcs = normalizeGcsSettings(input.gcs, current.gcs);
    const supabaseS3 = normalizeSupabaseS3Settings(input.supabaseS3, current.supabaseS3);

    if (activeProvider === 'gcs') {
      assertUsableGcsSettings(gcs);
    } else if (activeProvider === 'supabase_s3') {
      assertUsableSupabaseS3Settings(supabaseS3);
    }

    return {
      settings: {
        activeProvider,
        localPublicAssetBaseUrl: getLocalPublicAssetBaseUrl(),
        gcs: {
          ...gcs,
          credentialsSource: 'application_default_credentials',
        },
        supabaseS3: toSupabaseS3SettingsDto(supabaseS3),
        recommendedProductionProvider: 'gcs',
        updatedAt: current.updatedAt,
      },
      supabaseS3SecretAccessKey:
        activeProvider === 'supabase_s3' ? supabaseS3.secretAccessKey : null,
    };
  }

  getCurrentSupabaseS3SecretAccessKey(): string | null {
    const config = resolveRuntimeConfig(readStoredConfig());
    return config.activeProvider === 'supabase_s3' ? config.supabaseS3.secretAccessKey : null;
  }
}

export function assertUsableGcsSettings(settings: Omit<GcsAssetStorageSettingsDto, 'credentialsSource'>): void {
  if (!settings.bucketName?.trim()) {
    throw new Error('Google Cloud bucket name cannot be empty.');
  }

  if (!settings.publicAssetBaseUrl?.trim()) {
    throw new Error('CDN public base URL cannot be empty.');
  }
}

export function assertUsableSupabaseS3Settings(settings: SupabaseS3AssetStorageConfig): void {
  if (!settings.endpoint?.trim()) {
    throw new Error('Supabase S3 endpoint cannot be empty.');
  }

  if (!settings.region.trim()) {
    throw new Error('Supabase S3 region cannot be empty.');
  }

  if (!settings.bucketName?.trim()) {
    throw new Error('Supabase bucket name cannot be empty.');
  }

  if (!settings.accessKeyId?.trim()) {
    throw new Error('Supabase S3 access key ID cannot be empty.');
  }

  if (!settings.secretAccessKey.trim()) {
    throw new Error('Supabase S3 secret access key cannot be empty.');
  }

  if (!settings.publicAssetBaseUrl?.trim()) {
    throw new Error('CDN public base URL cannot be empty.');
  }
}

function createFallbackConfig(): AssetStorageConfig {
  return {
    version: 2,
    activeProvider: 'local',
    gcs: {
      projectId: null,
      bucketName: null,
      objectPrefix: DEFAULT_GCS_OBJECT_PREFIX,
      publicAssetBaseUrl: null,
      cacheControl: DEFAULT_GCS_CACHE_CONTROL,
    },
    supabaseS3: {
      endpoint: null,
      region: DEFAULT_SUPABASE_S3_REGION,
      bucketName: null,
      accessKeyId: null,
      secretAccessKey: '',
      objectPrefix: DEFAULT_SUPABASE_S3_OBJECT_PREFIX,
      publicAssetBaseUrl: null,
      cacheControl: DEFAULT_SUPABASE_S3_CACHE_CONTROL,
      forcePathStyle: true,
    },
    updatedAt: null,
  };
}

function readStoredConfig(): AssetStorageConfig {
  const configPath = resolveConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });

  if (!existsSync(configPath)) {
    const defaults = createFallbackConfig();
    writeFileSync(configPath, JSON.stringify(defaults, null, 2));
    return defaults;
  }

  return parseConfig(readFileSync(configPath, 'utf8'));
}

function writeConfig(config: AssetStorageConfig): void {
  const configPath = resolveConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function parseConfig(rawValue: string): AssetStorageConfig {
  const defaults = createFallbackConfig();
  const parsed = JSON.parse(rawValue) as Partial<AssetStorageConfig>;

  return {
    version: 2,
    activeProvider: normalizeProvider(parsed.activeProvider ?? defaults.activeProvider),
    gcs: normalizeGcsSettings(parsed.gcs, defaults.gcs),
    supabaseS3: normalizeSupabaseS3Settings(parsed.supabaseS3, defaults.supabaseS3),
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
  };
}

function hasEnv(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(process.env, key);
}

function resolveRuntimeConfig(config: AssetStorageConfig): AssetStorageConfig {
  const activeProvider = hasEnv(STORAGE_PROVIDER_ENV)
    ? normalizeProvider(process.env[STORAGE_PROVIDER_ENV])
    : config.activeProvider;

  return {
    ...config,
    activeProvider,
    gcs: resolveRuntimeGcsSettings(config.gcs),
    supabaseS3: resolveRuntimeSupabaseS3Settings(config.supabaseS3),
  };
}

function resolveRuntimeGcsSettings(current: AssetStorageConfig['gcs']): AssetStorageConfig['gcs'] {
  return {
    projectId: hasEnv(GCS_PROJECT_ID_ENV) ? normalizeNullableString(process.env[GCS_PROJECT_ID_ENV], 128) : current.projectId,
    bucketName: hasEnv(GCS_BUCKET_ENV) ? normalizeNullableString(process.env[GCS_BUCKET_ENV], 256) : current.bucketName,
    objectPrefix: hasEnv(GCS_OBJECT_PREFIX_ENV)
      ? normalizeObjectPrefix(process.env[GCS_OBJECT_PREFIX_ENV])
      : current.objectPrefix,
    publicAssetBaseUrl: hasEnv(GCS_PUBLIC_BASE_URL_ENV)
      ? normalizeNullableUrl(process.env[GCS_PUBLIC_BASE_URL_ENV])
      : current.publicAssetBaseUrl,
    cacheControl: hasEnv(GCS_CACHE_CONTROL_ENV)
      ? normalizeCacheControl(process.env[GCS_CACHE_CONTROL_ENV])
      : current.cacheControl,
  };
}

function resolveRuntimeSupabaseS3Settings(
  current: SupabaseS3AssetStorageConfig,
): SupabaseS3AssetStorageConfig {
  return {
    endpoint: hasEnv(SUPABASE_S3_ENDPOINT_ENV)
      ? normalizeNullableUrl(process.env[SUPABASE_S3_ENDPOINT_ENV])
      : current.endpoint,
    region: hasEnv(SUPABASE_S3_REGION_ENV)
      ? normalizeRequiredValue(process.env[SUPABASE_S3_REGION_ENV], DEFAULT_SUPABASE_S3_REGION, 128)
      : current.region,
    bucketName: hasEnv(SUPABASE_S3_BUCKET_ENV)
      ? normalizeNullableString(process.env[SUPABASE_S3_BUCKET_ENV], 256)
      : current.bucketName,
    accessKeyId: hasEnv(SUPABASE_S3_ACCESS_KEY_ID_ENV)
      ? normalizeNullableString(process.env[SUPABASE_S3_ACCESS_KEY_ID_ENV], 256)
      : current.accessKeyId,
    secretAccessKey: hasEnv(SUPABASE_S3_SECRET_ACCESS_KEY_ENV)
      ? (readString(process.env[SUPABASE_S3_SECRET_ACCESS_KEY_ENV]) ?? '')
      : current.secretAccessKey,
    objectPrefix: hasEnv(SUPABASE_S3_OBJECT_PREFIX_ENV)
      ? normalizeObjectPrefix(process.env[SUPABASE_S3_OBJECT_PREFIX_ENV])
      : current.objectPrefix,
    publicAssetBaseUrl: hasEnv(SUPABASE_S3_PUBLIC_BASE_URL_ENV)
      ? normalizeNullableUrl(process.env[SUPABASE_S3_PUBLIC_BASE_URL_ENV])
      : current.publicAssetBaseUrl,
    cacheControl: hasEnv(SUPABASE_S3_CACHE_CONTROL_ENV)
      ? normalizeCacheControl(process.env[SUPABASE_S3_CACHE_CONTROL_ENV])
      : current.cacheControl,
    forcePathStyle: true,
  };
}

function normalizeProvider(value: unknown): AssetStorageSettingsDto['activeProvider'] {
  return value === 'gcs' || value === 'supabase_s3' ? value : 'local';
}

function normalizeGcsSettings(
  input: UpdateAssetStorageSettingsDto['gcs'] | Partial<AssetStorageConfig['gcs']> | null | undefined,
  current: AssetStorageConfig['gcs'],
): AssetStorageConfig['gcs'] {
  if (!input) {
    return current;
  }

  return {
    projectId: hasOwn(input, 'projectId') ? normalizeNullableString(input.projectId, 128) : current.projectId,
    bucketName: hasOwn(input, 'bucketName') ? normalizeNullableString(input.bucketName, 256) : current.bucketName,
    objectPrefix: hasOwn(input, 'objectPrefix') ? normalizeObjectPrefix(input.objectPrefix) : current.objectPrefix,
    publicAssetBaseUrl: hasOwn(input, 'publicAssetBaseUrl')
      ? normalizeNullableUrl(input.publicAssetBaseUrl)
      : current.publicAssetBaseUrl,
    cacheControl: hasOwn(input, 'cacheControl') ? normalizeCacheControl(input.cacheControl) : current.cacheControl,
  };
}

function supabaseS3IdentityMatches(
  left: SupabaseS3AssetStorageConfig,
  right: SupabaseS3AssetStorageConfig,
): boolean {
  return (
    left.endpoint === right.endpoint &&
    left.region === right.region &&
    left.bucketName === right.bucketName &&
    left.accessKeyId === right.accessKeyId
  );
}

function normalizeSupabaseS3Settings(
  input:
    | UpdateAssetStorageSettingsDto['supabaseS3']
    | Partial<SupabaseS3AssetStorageConfig>
    | null
    | undefined,
  current: SupabaseS3AssetStorageConfig,
): SupabaseS3AssetStorageConfig {
  if (!input) {
    return current;
  }

  const nextWithoutSecret: SupabaseS3AssetStorageConfig = {
    endpoint: hasOwn(input, 'endpoint') ? normalizeNullableUrl(input.endpoint) : current.endpoint,
    region: hasOwn(input, 'region')
      ? normalizeRequiredValue(input.region, DEFAULT_SUPABASE_S3_REGION, 128)
      : current.region,
    bucketName: hasOwn(input, 'bucketName')
      ? normalizeNullableString(input.bucketName, 256)
      : current.bucketName,
    accessKeyId: hasOwn(input, 'accessKeyId')
      ? normalizeNullableString(input.accessKeyId, 256)
      : current.accessKeyId,
    secretAccessKey: '',
    objectPrefix: hasOwn(input, 'objectPrefix')
      ? normalizeObjectPrefix(input.objectPrefix)
      : current.objectPrefix,
    publicAssetBaseUrl: hasOwn(input, 'publicAssetBaseUrl')
      ? normalizeNullableUrl(input.publicAssetBaseUrl)
      : current.publicAssetBaseUrl,
    cacheControl: hasOwn(input, 'cacheControl')
      ? normalizeCacheControl(input.cacheControl)
      : current.cacheControl,
    forcePathStyle: true,
  };

  const secretAccessKey =
    hasOwn(input, 'secretAccessKey') && typeof input.secretAccessKey === 'string'
      ? (readString(input.secretAccessKey) ?? '')
      : '';
  if (secretAccessKey.length > 2048) {
    throw new Error('Supabase S3 secret access key can be at most 2048 characters.');
  }

  return {
    ...nextWithoutSecret,
    secretAccessKey:
      secretAccessKey ||
      (supabaseS3IdentityMatches(nextWithoutSecret, current) ? current.secretAccessKey : ''),
  };
}

function toSupabaseS3SettingsDto(config: SupabaseS3AssetStorageConfig): SupabaseS3AssetStorageSettingsDto {
  return {
    endpoint: config.endpoint,
    region: config.region,
    bucketName: config.bucketName,
    accessKeyId: config.accessKeyId,
    secretAccessKeyConfigured: config.secretAccessKey.length > 0,
    objectPrefix: config.objectPrefix,
    publicAssetBaseUrl: config.publicAssetBaseUrl,
    cacheControl: config.cacheControl,
    forcePathStyle: true,
  };
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeNullableString(value: unknown, maxLength: number): string | null {
  const normalized = readString(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new Error(`Value can be at most ${maxLength} characters.`);
  }

  return normalized;
}

function normalizeRequiredValue(value: unknown, fallback: string, maxLength: number): string {
  const normalized = readString(value) ?? fallback;
  if (normalized.length > maxLength) {
    throw new Error(`Value can be at most ${maxLength} characters.`);
  }

  return normalized;
}

function normalizeNullableUrl(value: unknown): string | null {
  const normalized = readString(value);
  if (!normalized) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('CDN public base URL must be a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('CDN public base URL can only use http or https.');
  }

  return parsed.toString().replace(/\/+$/, '');
}

function normalizeObjectPrefix(value: unknown): string {
  const normalized = readString(value) ?? DEFAULT_GCS_OBJECT_PREFIX;
  return normalized.replace(/^\/+|\/+$/g, '') || DEFAULT_GCS_OBJECT_PREFIX;
}

function normalizeCacheControl(value: unknown): string {
  const normalized = readString(value) ?? DEFAULT_GCS_CACHE_CONTROL;
  if (normalized.length > 256) {
    throw new Error('Cache-Control can be at most 256 characters.');
  }

  return normalized;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getLocalPublicAssetBaseUrl(): string {
  return (process.env[LOCAL_PUBLIC_BASE_URL_ENV]?.trim() || DEFAULT_LOCAL_PUBLIC_ASSET_BASE_URL).replace(/\/+$/, '');
}

function resolveConfigPath(): string {
  const configuredPath = process.env[CONFIG_PATH_ENV]?.trim();
  if (configuredPath) {
    return resolve(configuredPath);
  }

  return resolveDefaultDataPath('asset-storage-config.json');
}

function resolveDefaultDataPath(fileName: string): string {
  let currentDir = process.cwd();

  while (true) {
    if (existsSync(resolve(currentDir, 'apps/api')) && existsSync(resolve(currentDir, 'apps/admin-web'))) {
      return resolve(currentDir, 'apps/api/data', fileName);
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return resolve(process.cwd(), 'data', fileName);
    }

    currentDir = parentDir;
  }
}
