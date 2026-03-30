import { createHash, timingSafeEqual } from 'node:crypto';

export const STATIC_TOKEN_HASH_PREFIX = 'sha256:';

export const hashStaticToken = (token: string): string => {
  const digest = createHash('sha256').update(token).digest('hex');
  return `${STATIC_TOKEN_HASH_PREFIX}${digest}`;
};

export const verifyStaticTokenHash = (
  candidateToken: string,
  persistedHash: string,
): boolean => {
  if (!persistedHash.startsWith(STATIC_TOKEN_HASH_PREFIX)) {
    return false;
  }

  const expectedBuffer = Buffer.from(hashStaticToken(candidateToken));
  const actualBuffer = Buffer.from(persistedHash);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
};
