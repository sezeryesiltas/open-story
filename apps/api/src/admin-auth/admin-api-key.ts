import { randomBytes } from 'node:crypto';

export const ADMIN_API_KEY_PREFIX = 'osak_';
export const ADMIN_CLIENT_SECRET_PREFIX = 'oscs_';

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const CLIENT_SECRET_PATTERN = `${ADMIN_CLIENT_SECRET_PREFIX}[A-Za-z0-9_-]+`;
const ADMIN_API_KEY_PATTERN = new RegExp(`^${ADMIN_API_KEY_PREFIX}(${UUID_PATTERN})\\.(${CLIENT_SECRET_PATTERN})$`, 'i');

export type ParsedAdminApiKey = {
  keyId: string;
  clientSecret: string;
};

export const createAdminClientSecret = (): string =>
  `${ADMIN_CLIENT_SECRET_PREFIX}${randomBytes(32).toString('base64url')}`;

export const createAdminApiKey = (keyId: string, clientSecret: string): string =>
  `${ADMIN_API_KEY_PREFIX}${keyId}.${clientSecret}`;

export const createAdminApiKeyPrefix = (keyId: string): string =>
  `${ADMIN_API_KEY_PREFIX}${keyId.slice(0, 8)}`;

export const parseAdminApiKey = (value: string): ParsedAdminApiKey | null => {
  const match = ADMIN_API_KEY_PATTERN.exec(value.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    keyId: match[1].toLowerCase(),
    clientSecret: match[2],
  };
};
