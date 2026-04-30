import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type {
  AssetStorageSettingsDto,
  GcsAssetStorageSettingsDto,
  UpdateAssetStorageSettingsDto,
} from '@open-story/contracts';

type AssetStorageConfig = {
  version: 1;
  activeProvider: AssetStorageSettingsDto['activeProvider'];
  gcs: Omit<GcsAssetStorageSettingsDto, 'credentialsSource'>;
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

const DEFAULT_LOCAL_PUBLIC_ASSET_BASE_URL = 'http://localhost:3001/uploads/assets';
const DEFAULT_GCS_OBJECT_PREFIX = 'assets';
const DEFAULT_GCS_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export class AssetStorageSettingsStore {
  getSettings(): AssetStorageSettingsDto {
    const config = readConfig();

    return {
      activeProvider: config.activeProvider,
      localPublicAssetBaseUrl: getLocalPublicAssetBaseUrl(),
      gcs: {
        ...config.gcs,
        credentialsSource: 'application_default_credentials',
      },
      recommendedProductionProvider: 'gcs',
      updatedAt: config.updatedAt,
    };
  }

  updateSettings(input: UpdateAssetStorageSettingsDto): AssetStorageSettingsDto {
    const current = readConfig();
    const next: AssetStorageConfig = {
      ...current,
      activeProvider: normalizeProvider(input.activeProvider ?? current.activeProvider),
      gcs: normalizeGcsSettings(input.gcs, current.gcs),
      updatedAt: new Date().toISOString(),
    };

    if (next.activeProvider === 'gcs') {
      assertUsableGcsSettings(next.gcs);
    }

    writeConfig(next);
    return this.getSettings();
  }

  normalizeCandidate(input: UpdateAssetStorageSettingsDto): AssetStorageSettingsDto {
    const current = readConfig();
    const activeProvider = normalizeProvider(input.activeProvider ?? current.activeProvider);
    const gcs = normalizeGcsSettings(input.gcs, current.gcs);

    if (activeProvider === 'gcs') {
      assertUsableGcsSettings(gcs);
    }

    return {
      activeProvider,
      localPublicAssetBaseUrl: getLocalPublicAssetBaseUrl(),
      gcs: {
        ...gcs,
        credentialsSource: 'application_default_credentials',
      },
      recommendedProductionProvider: 'gcs',
      updatedAt: current.updatedAt,
    };
  }
}

export function assertUsableGcsSettings(settings: Omit<GcsAssetStorageSettingsDto, 'credentialsSource'>): void {
  if (!settings.bucketName?.trim()) {
    throw new Error('Google Cloud bucket adı boş bırakılamaz.');
  }

  if (!settings.publicAssetBaseUrl?.trim()) {
    throw new Error('CDN public base URL boş bırakılamaz.');
  }
}

function createDefaultConfig(): AssetStorageConfig {
  return {
    version: 1,
    activeProvider: process.env[STORAGE_PROVIDER_ENV]?.trim() === 'gcs' ? 'gcs' : 'local',
    gcs: {
      projectId: readString(process.env[GCS_PROJECT_ID_ENV]),
      bucketName: readString(process.env[GCS_BUCKET_ENV]),
      objectPrefix: normalizeObjectPrefix(process.env[GCS_OBJECT_PREFIX_ENV] ?? DEFAULT_GCS_OBJECT_PREFIX),
      publicAssetBaseUrl: readString(process.env[GCS_PUBLIC_BASE_URL_ENV]),
      cacheControl: readString(process.env[GCS_CACHE_CONTROL_ENV]) ?? DEFAULT_GCS_CACHE_CONTROL,
    },
    updatedAt: null,
  };
}

function readConfig(): AssetStorageConfig {
  const configPath = resolveConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });

  if (!existsSync(configPath)) {
    const defaults = createDefaultConfig();
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
  const defaults = createDefaultConfig();
  const parsed = JSON.parse(rawValue) as Partial<AssetStorageConfig>;

  return {
    version: 1,
    activeProvider: normalizeProvider(parsed.activeProvider ?? defaults.activeProvider),
    gcs: normalizeGcsSettings(parsed.gcs, defaults.gcs),
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
  };
}

function normalizeProvider(value: unknown): AssetStorageSettingsDto['activeProvider'] {
  return value === 'gcs' ? 'gcs' : 'local';
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

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeNullableString(value: unknown, maxLength: number): string | null {
  const normalized = readString(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new Error(`Değer en fazla ${maxLength} karakter olabilir.`);
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
    throw new Error('CDN public base URL geçerli bir URL olmalıdır.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('CDN public base URL yalnızca http veya https olabilir.');
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
    throw new Error('Cache-Control en fazla 256 karakter olabilir.');
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
