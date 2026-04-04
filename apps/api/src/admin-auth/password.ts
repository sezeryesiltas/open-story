import { scryptSync, timingSafeEqual } from 'node:crypto';

export const hashPassword = (password: string, salt: string): string => {
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
};

export const verifyPassword = (password: string, hashedPassword: string): boolean => {
  const [algo, salt, expected] = hashedPassword.split(':');
  if (algo !== 'scrypt' || !salt || !expected) {
    return false;
  }

  const actual = scryptSync(password, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
};
