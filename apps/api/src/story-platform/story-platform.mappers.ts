import type {
  AdminApiKeyDto,
  AdminApiKeyRecord,
  AdminUserDto,
  AuthSessionDto,
  AuthUserDto,
  AdminSessionRecord,
  AdminUserRecord,
  ClientDto,
  ClientRecord,
  StaticTokenDto,
  StaticTokenRecord,
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

export const toClientDto = (record: ClientRecord): ClientDto => ({
  id: record.id,
  clientId: record.clientId,
  name: record.name,
  isActive: record.isActive,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const toStaticTokenDto = (
  record: StaticTokenRecord,
  clientPublicId: string,
): StaticTokenDto => ({
  id: record.id,
  clientId: clientPublicId,
  label: record.label,
  tokenPrefix: record.tokenPrefix,
  isActive: record.isActive,
  createdAt: record.createdAt,
  revokedAt: record.revokedAt,
});

export const toAdminApiKeyDto = (record: AdminApiKeyRecord): AdminApiKeyDto => ({
  id: record.id,
  clientName: record.clientName,
  keyPrefix: record.keyPrefix,
  isActive: record.isActive,
  createdAt: record.createdAt,
  revokedAt: record.revokedAt,
  lastUsedAt: record.lastUsedAt ?? null,
});
