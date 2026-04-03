import type {
  AdminSessionDto,
  AdminUserDto,
  AuthSessionDto,
  AuthUserDto,
  AdminSessionRecord,
  AdminUserRecord,
} from '@open-story/contracts';

export const toAuthUserDto = (record: AdminUserRecord): AuthUserDto => ({
  id: record.id,
  email: record.email,
  mustChangePassword: record.mustChangePassword,
  isActive: record.isActive,
});

export const toAuthSessionDto = (record: AdminSessionRecord): AuthSessionDto => ({
  id: record.id,
  expiresAt: record.expiresAt,
});

export const toAdminUserDto = (record: AdminUserRecord): AdminUserDto => ({
  id: record.id,
  email: record.email,
  mustChangePassword: record.mustChangePassword,
  isActive: record.isActive,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
