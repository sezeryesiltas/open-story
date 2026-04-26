import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

import type { AssetRecord } from '@open-story/contracts';

import { ApiServiceError } from '../../common/filters/api-error.ts';

export type AssetType = 'group_logo' | 'story_image' | 'story_video' | 'story_poster';

export type AssetUploadInput = {
  type: AssetType;
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
  createdByAdminUserId: string | null;
};

export type AssetImportFromUrlInput = {
  type: AssetType;
  url: string;
  createdByAdminUserId: string | null;
};

type AssetCreationSource = 'upload' | 'url';

type DetectedAsset =
  | {
      detectedMimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
      mediaType: 'image';
      width: number;
      height: number;
      durationMs: null;
      extension: string;
    }
  | {
      detectedMimeType: 'video/mp4';
      mediaType: 'video';
      width: number;
      height: number;
      durationMs: number;
      extension: string;
    };

type Mp4TrackMetadata = {
  width: number;
  height: number;
};

type Atom = {
  type: string;
  start: number;
  size: number;
  headerSize: number;
  payloadStart: number;
  end: number;
};

const DEFAULT_PUBLIC_ASSET_BASE_URL = 'http://localhost:3001/uploads/assets';
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export function createAssetRecordFromUpload(input: AssetUploadInput): AssetRecord {
  return createAssetRecordFromBuffer({
    type: input.type,
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    buffer: input.buffer,
    createdByAdminUserId: input.createdByAdminUserId,
    source: 'upload',
    publicUrl: null,
  });
}

export async function createAssetRecordFromUrlImport(input: AssetImportFromUrlInput): Promise<AssetRecord> {
  let normalizedUrl: URL;

  try {
    normalizedUrl = new URL(input.url);
  } catch {
    throw ApiServiceError.badRequest('Geçerli bir asset URL girin.');
  }

  if (normalizedUrl.protocol !== 'http:' && normalizedUrl.protocol !== 'https:') {
    throw ApiServiceError.badRequest('Asset URL yalnızca http veya https olabilir.');
  }

  let response: Response;

  try {
    response = await fetch(normalizedUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw ApiServiceError.badRequest('Asset URL indirilemedi.');
  }

  if (!response.ok) {
    throw ApiServiceError.badRequest(`Asset URL indirilemedi (${response.status}).`);
  }

  const finalUrl = response.url ? new URL(response.url).toString() : normalizedUrl.toString();
  const fileName = guessFileNameFromUrl(finalUrl);
  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || null;
  const buffer = Buffer.from(await response.arrayBuffer());

  return createAssetRecordFromBuffer({
    type: input.type,
    fileName,
    mimeType,
    buffer,
    createdByAdminUserId: input.createdByAdminUserId,
    source: 'url',
    publicUrl: finalUrl,
  });
}

export function deleteAssetBinary(record: AssetRecord): void {
  if (record.source !== 'upload') {
    return;
  }

  const filePath = resolveAssetFilePath(record.storageKey);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function createAssetRecordFromBuffer(input: {
  type: AssetType;
  fileName: string;
  mimeType: string | null;
  buffer: Buffer;
  createdByAdminUserId: string | null;
  source: AssetCreationSource;
  publicUrl: string | null;
}): AssetRecord {
  const normalizedFileName = normalizeFileName(input.fileName);
  const detectedAsset = detectAsset(input.buffer);
  validateUpload(input.type, normalizedFileName, input.mimeType ?? null, input.buffer.byteLength, detectedAsset);

  const persistedKind = toPersistedKind(input.type);
  const now = new Date().toISOString();
  const extension = extname(normalizedFileName) || detectedAsset.extension;
  const storageKey =
    input.source === 'upload'
      ? `${persistedKind}/${randomUUID()}${extension.toLowerCase()}`
      : `remote/${persistedKind}/${randomUUID()}${extension.toLowerCase()}`;

  if (input.source === 'upload') {
    const filePath = resolveAssetFilePath(storageKey);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, input.buffer);
  }

  return {
    id: randomUUID(),
    kind: persistedKind,
    source: input.source,
    mediaType: detectedAsset.mediaType,
    storageKey,
    publicUrl: input.publicUrl ?? buildPublicAssetUrl(storageKey),
    sourceFileName: normalizedFileName,
    mimeType: detectedAsset.detectedMimeType,
    sizeBytes: input.buffer.byteLength,
    width: detectedAsset.width,
    height: detectedAsset.height,
    durationMs: detectedAsset.durationMs,
    checksumSha256: createHash('sha256').update(input.buffer).digest('hex'),
    createdByAdminUserId: input.createdByAdminUserId,
    createdAt: now,
    updatedAt: now,
  };
}

function validateUpload(
  assetType: AssetType,
  fileName: string,
  claimedMimeType: string | null,
  sizeBytes: number,
  detectedAsset: DetectedAsset,
): void {
  if (!fileName) {
    throw ApiServiceError.badRequest('Asset dosya adı zorunludur.');
  }

  if (sizeBytes <= 0) {
    throw ApiServiceError.badRequest('Yüklenecek dosya boş olamaz.');
  }

  if (claimedMimeType && claimedMimeType.trim() && claimedMimeType.trim().toLowerCase() !== detectedAsset.detectedMimeType) {
    throw ApiServiceError.badRequest('Dosya MIME tipi ile içerik eşleşmiyor.');
  }

  switch (assetType) {
    case 'group_logo':
      if (detectedAsset.mediaType !== 'image') {
        throw ApiServiceError.badRequest('Group logo için yalnızca görsel yüklenebilir.');
      }

      if (detectedAsset.width !== detectedAsset.height) {
        throw ApiServiceError.badRequest('Group logo kare olmalıdır.');
      }
      break;
    case 'story_image':
    case 'story_poster':
      if (detectedAsset.mediaType !== 'image') {
        throw ApiServiceError.badRequest('Story image/poster için yalnızca görsel yüklenebilir.');
      }
      break;
    case 'story_video':
      if (detectedAsset.mediaType !== 'video') {
        throw ApiServiceError.badRequest('Story video için yalnızca MP4 video yüklenebilir.');
      }

      if (sizeBytes > MAX_VIDEO_SIZE_BYTES) {
        throw ApiServiceError.badRequest('Video dosyası 50 MB sınırını aşamaz.');
      }

      if (detectedAsset.durationMs > 30_000) {
        throw ApiServiceError.badRequest('Video süresi en fazla 30 saniye olabilir.');
      }
      break;
    default:
      throw ApiServiceError.badRequest('Geçerli bir asset tipi seçin.');
  }
}

function toPersistedKind(assetType: AssetType): AssetRecord['kind'] {
  if (assetType === 'story_poster') {
    return 'story_video_poster';
  }

  return assetType;
}

function buildPublicAssetUrl(storageKey: string): string {
  const baseUrl = normalizeBaseUrl(process.env.OPEN_STORY_PUBLIC_ASSET_BASE_URL?.trim() || DEFAULT_PUBLIC_ASSET_BASE_URL);
  return `${baseUrl}/${storageKey}`;
}

function normalizeBaseUrl(value: string): string {
  if (!value) {
    return DEFAULT_PUBLIC_ASSET_BASE_URL;
  }

  return value.replace(/\/+$/, '');
}

function resolveAssetFilePath(storageKey: string): string {
  return resolve(resolveAssetsRoot(), storageKey);
}

function resolveAssetsRoot(): string {
  const configuredDir = process.env.OPEN_STORY_ASSET_STORAGE_DIR?.trim();
  if (configuredDir) {
    return resolve(configuredDir);
  }

  const workspaceRoot = findWorkspaceRoot(process.cwd());
  if (workspaceRoot) {
    return resolve(workspaceRoot, 'apps/api/data/assets');
  }

  return resolve(process.cwd(), 'apps/api/data/assets');
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

function normalizeFileName(value: string): string {
  const normalized = value.trim().replace(/[\\/]+/g, '-');
  return normalized || 'asset';
}

function guessFileNameFromUrl(urlValue: string): string {
  try {
    const parsedUrl = new URL(urlValue);
    const pathname = parsedUrl.pathname.split('/').pop()?.trim() || '';
    return pathname || 'asset';
  } catch {
    return 'asset';
  }
}

function detectAsset(buffer: Buffer): DetectedAsset {
  if (isPng(buffer)) {
    const { width, height } = readPngDimensions(buffer);
    return {
      detectedMimeType: 'image/png',
      mediaType: 'image',
      width,
      height,
      durationMs: null,
      extension: '.png',
    };
  }

  if (isJpeg(buffer)) {
    const { width, height } = readJpegDimensions(buffer);
    return {
      detectedMimeType: 'image/jpeg',
      mediaType: 'image',
      width,
      height,
      durationMs: null,
      extension: '.jpg',
    };
  }

  if (isWebp(buffer)) {
    const { width, height } = readWebpDimensions(buffer);
    return {
      detectedMimeType: 'image/webp',
      mediaType: 'image',
      width,
      height,
      durationMs: null,
      extension: '.webp',
    };
  }

  if (isSvg(buffer)) {
    const { width, height } = readSvgDimensions(buffer);
    return {
      detectedMimeType: 'image/svg+xml',
      mediaType: 'image',
      width,
      height,
      durationMs: null,
      extension: '.svg',
    };
  }

  if (isMp4(buffer)) {
    const { width, height, durationMs } = readMp4Metadata(buffer);
    return {
      detectedMimeType: 'video/mp4',
      mediaType: 'video',
      width,
      height,
      durationMs,
      extension: '.mp4',
    };
  }

  throw ApiServiceError.badRequest('Desteklenmeyen asset dosyası.');
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.byteLength >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  if (width <= 0 || height <= 0) {
    throw ApiServiceError.badRequest('PNG boyut bilgisi okunamadı.');
  }

  return { width, height };
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.byteLength >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } {
  let offset = 2;

  while (offset + 9 < buffer.byteLength) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);

      if (width <= 0 || height <= 0) {
        break;
      }

      return { width, height };
    }

    offset += 2 + segmentLength;
  }

  throw ApiServiceError.badRequest('JPEG boyut bilgisi okunamadı.');
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.byteLength >= 16 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function readWebpDimensions(buffer: Buffer): { width: number; height: number } {
  const chunkType = buffer.subarray(12, 16).toString('ascii');

  if (chunkType === 'VP8X' && buffer.byteLength >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  if (chunkType === 'VP8 ' && buffer.byteLength >= 30) {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }

  if (chunkType === 'VP8L' && buffer.byteLength >= 25) {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  throw ApiServiceError.badRequest('WEBP boyut bilgisi okunamadı.');
}

function isSvg(buffer: Buffer): boolean {
  const text = buffer.toString('utf8', 0, Math.min(buffer.byteLength, 512)).trimStart();
  return text.startsWith('<svg') || text.startsWith('<?xml');
}

function readSvgDimensions(buffer: Buffer): { width: number; height: number } {
  const text = buffer.toString('utf8');
  const svgTagMatch = text.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) {
    throw ApiServiceError.badRequest('SVG metadata okunamadı.');
  }

  const svgTag = svgTagMatch[0];
  const viewBoxMatch = svgTag.match(/viewBox\s*=\s*["']\s*[-.\d]+\s+[-.\d]+\s+([.\d]+)\s+([.\d]+)\s*["']/i);
  if (viewBoxMatch) {
    const width = Number(viewBoxMatch[1]);
    const height = Number(viewBoxMatch[2]);

    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }

  const widthMatch = svgTag.match(/width\s*=\s*["']\s*([.\d]+)/i);
  const heightMatch = svgTag.match(/height\s*=\s*["']\s*([.\d]+)/i);
  const width = widthMatch ? Number(widthMatch[1]) : NaN;
  const height = heightMatch ? Number(heightMatch[1]) : NaN;

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  throw ApiServiceError.badRequest('SVG genişlik ve yükseklik bilgisi okunamadı.');
}

function isMp4(buffer: Buffer): boolean {
  return buffer.byteLength >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

function readMp4Metadata(buffer: Buffer): { width: number; height: number; durationMs: number } {
  const rootAtoms = readAtoms(buffer, 0, buffer.byteLength);
  const moovAtom = rootAtoms.find((atom) => atom.type === 'moov');
  if (!moovAtom) {
    throw ApiServiceError.badRequest('MP4 metadata okunamadı.');
  }

  const moovChildren = readAtoms(buffer, moovAtom.payloadStart, moovAtom.end);
  const mvhdAtom = moovChildren.find((atom) => atom.type === 'mvhd');
  if (!mvhdAtom) {
    throw ApiServiceError.badRequest('MP4 duration metadata okunamadı.');
  }

  const durationMs = readMp4DurationMs(buffer, mvhdAtom);
  const videoTrack = moovChildren
    .filter((atom) => atom.type === 'trak')
    .map((atom) => readMp4VideoTrack(buffer, atom))
    .find((metadata) => metadata !== null);

  if (!videoTrack) {
    throw ApiServiceError.badRequest('MP4 video track metadata okunamadı.');
  }

  return {
    width: videoTrack.width,
    height: videoTrack.height,
    durationMs,
  };
}

function readAtoms(buffer: Buffer, start: number, end: number): Atom[] {
  const atoms: Atom[] = [];
  let offset = start;

  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > end) {
        break;
      }

      const largeSize = Number(buffer.readBigUInt64BE(offset + 8));
      if (!Number.isFinite(largeSize) || largeSize < 16) {
        break;
      }

      size = largeSize;
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < headerSize || offset + size > end) {
      break;
    }

    atoms.push({
      type,
      start: offset,
      size,
      headerSize,
      payloadStart: offset + headerSize,
      end: offset + size,
    });

    offset += size;
  }

  return atoms;
}

function readMp4DurationMs(buffer: Buffer, atom: Atom): number {
  const version = buffer[atom.payloadStart];

  if (version === 1) {
    const timescale = buffer.readUInt32BE(atom.payloadStart + 20);
    const duration = Number(buffer.readBigUInt64BE(atom.payloadStart + 24));

    if (!timescale || !duration) {
      throw ApiServiceError.badRequest('MP4 duration metadata okunamadı.');
    }

    return Math.round((duration / timescale) * 1000);
  }

  const timescale = buffer.readUInt32BE(atom.payloadStart + 12);
  const duration = buffer.readUInt32BE(atom.payloadStart + 16);

  if (!timescale || !duration) {
    throw ApiServiceError.badRequest('MP4 duration metadata okunamadı.');
  }

  return Math.round((duration / timescale) * 1000);
}

function readMp4VideoTrack(buffer: Buffer, trakAtom: Atom): Mp4TrackMetadata | null {
  const trakChildren = readAtoms(buffer, trakAtom.payloadStart, trakAtom.end);
  const tkhdAtom = trakChildren.find((atom) => atom.type === 'tkhd');
  const mdiaAtom = trakChildren.find((atom) => atom.type === 'mdia');

  if (!tkhdAtom || !mdiaAtom) {
    return null;
  }

  const mdiaChildren = readAtoms(buffer, mdiaAtom.payloadStart, mdiaAtom.end);
  const hdlrAtom = mdiaChildren.find((atom) => atom.type === 'hdlr');
  if (!hdlrAtom) {
    return null;
  }

  const handlerType = buffer.subarray(hdlrAtom.payloadStart + 8, hdlrAtom.payloadStart + 12).toString('ascii');
  if (handlerType !== 'vide') {
    return null;
  }

  return readTkhdDimensions(buffer, tkhdAtom);
}

function readTkhdDimensions(buffer: Buffer, atom: Atom): Mp4TrackMetadata {
  const version = buffer[atom.payloadStart];
  const widthOffset = atom.payloadStart + (version === 1 ? 88 : 76);
  const heightOffset = atom.payloadStart + (version === 1 ? 92 : 80);
  const width = Math.round(buffer.readUInt32BE(widthOffset) / 65536);
  const height = Math.round(buffer.readUInt32BE(heightOffset) / 65536);

  if (width <= 0 || height <= 0) {
    throw ApiServiceError.badRequest('MP4 video boyutu okunamadı.');
  }

  return { width, height };
}
