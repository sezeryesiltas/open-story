import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';

import { DbService } from '@open-story/db';

const db = new DbService();
const DEFAULT_TIMESTAMP = new Date(0).toISOString();

export type AssetRecord = {
  id: string;
  type: 'group_logo' | 'story_image' | 'story_video' | 'story_poster';
  url: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  source: 'url' | 'upload';
  createdAt: string;
  updatedAt: string;
};

export class AssetStoreError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: 'validation_error',
  ) {
    super(message);
    this.name = 'AssetStoreError';
  }
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function normalizeAssetType(value: unknown): AssetRecord['type'] {
  const normalizedValue = parseString(value);

  if (
    normalizedValue === 'group_logo' ||
    normalizedValue === 'story_image' ||
    normalizedValue === 'story_video' ||
    normalizedValue === 'story_poster'
  ) {
    return normalizedValue;
  }

  throw new AssetStoreError('Geçerli bir asset tipi seçin.', 400, 'validation_error');
}

function normalizeAsset(rawRecord: { id: string; [key: string]: unknown }): AssetRecord {
  const createdAt = parseString(rawRecord.createdAt) ?? DEFAULT_TIMESTAMP;
  const updatedAt = parseString(rawRecord.updatedAt) ?? createdAt;
  const rawName =
    parseString(rawRecord.name) ??
    parseString(rawRecord.fileName) ??
    parseString(rawRecord.file_name) ??
    parseString(rawRecord.url) ??
    'Asset';

  return {
    id: rawRecord.id,
    type: normalizeAssetType(rawRecord.type ?? 'group_logo'),
    url: parseString(rawRecord.url) ?? '',
    name: rawName,
    mimeType: parseString(rawRecord.mimeType) ?? parseString(rawRecord.mime_type),
    width: parseNullableNumber(rawRecord.width),
    height: parseNullableNumber(rawRecord.height),
    sizeBytes: parseNullableNumber(rawRecord.sizeBytes ?? rawRecord.size_bytes),
    source: parseString(rawRecord.source) === 'upload' ? 'upload' : 'url',
    createdAt,
    updatedAt,
  };
}

function findAdminWebRoot(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    if (existsSync(resolve(currentDir, 'app')) && existsSync(resolve(currentDir, 'package.json'))) {
      return currentDir;
    }

    const candidate = resolve(currentDir, 'apps/admin-web');
    if (existsSync(resolve(candidate, 'app')) && existsSync(resolve(candidate, 'package.json'))) {
      return candidate;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new AssetStoreError('admin-web kök dizini bulunamadı.', 500, 'validation_error');
    }

    currentDir = parentDir;
  }
}

function ensureUploadsDirectory(): string {
  const uploadsDir = resolve(findAdminWebRoot(process.cwd()), 'public/uploads/assets');
  mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'asset';
}

function guessNameFromUrl(urlValue: string): string {
  try {
    const parsedUrl = new URL(urlValue);
    const pathnameName = basename(parsedUrl.pathname);
    return pathnameName || 'Remote Asset';
  } catch {
    return 'Remote Asset';
  }
}

export function listAssets(type?: AssetRecord['type']): AssetRecord[] {
  return db
    .list<{ id: string; [key: string]: unknown }>('assets')
    .map(normalizeAsset)
    .filter((asset) => (type ? asset.type === type : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createUrlAsset(payload: {
  type: unknown;
  url: unknown;
  name?: unknown;
  mimeType?: unknown;
  width?: unknown;
  height?: unknown;
  sizeBytes?: unknown;
}): AssetRecord {
  const type = normalizeAssetType(payload.type);
  const url = parseString(payload.url);

  if (!url) {
    throw new AssetStoreError('Asset URL zorunludur.', 400, 'validation_error');
  }

  try {
    new URL(url);
  } catch {
    throw new AssetStoreError('Geçerli bir asset URL girin.', 400, 'validation_error');
  }

  const now = new Date().toISOString();

  const asset: AssetRecord = {
    id: randomUUID(),
    type,
    url,
    name: parseString(payload.name) ?? guessNameFromUrl(url),
    mimeType: parseString(payload.mimeType),
    width: parseNullableNumber(payload.width),
    height: parseNullableNumber(payload.height),
    sizeBytes: parseNullableNumber(payload.sizeBytes),
    source: 'url',
    createdAt: now,
    updatedAt: now,
  };

  return db.insert<AssetRecord>('assets', asset);
}

export async function createUploadedAsset(payload: {
  type: unknown;
  file: File;
  width?: unknown;
  height?: unknown;
}): Promise<AssetRecord> {
  const type = normalizeAssetType(payload.type);

  if (!payload.file || payload.file.size === 0) {
    throw new AssetStoreError('Yüklenecek dosya zorunludur.', 400, 'validation_error');
  }

  const uploadsDir = ensureUploadsDirectory();
  const fileExtension = extname(payload.file.name) || '.bin';
  const fileName = `${randomUUID()}-${sanitizeFilename(payload.file.name.replace(fileExtension, ''))}${fileExtension}`;
  const buffer = Buffer.from(await payload.file.arrayBuffer());
  const filePath = resolve(uploadsDir, fileName);

  writeFileSync(filePath, buffer);

  const now = new Date().toISOString();
  const asset: AssetRecord = {
    id: randomUUID(),
    type,
    url: `/uploads/assets/${fileName}`,
    name: payload.file.name,
    mimeType: parseString(payload.file.type),
    width: parseNullableNumber(payload.width),
    height: parseNullableNumber(payload.height),
    sizeBytes: payload.file.size,
    source: 'upload',
    createdAt: now,
    updatedAt: now,
  };

  return db.insert<AssetRecord>('assets', asset);
}
