import { randomBytes, randomUUID } from 'node:crypto';

import type {
  AdminApiKeyRecord,
  AdminRole,
  AdminSessionRecord,
  AdminUserRecord,
  ClientRecord,
  StaticTokenRecord,
} from '@open-story/contracts';
import { DbService } from '@open-story/db';

import { hashPassword } from '../admin-auth/password.ts';
import type { AdminSessionStore, AdminUserStore } from '../admin-auth/admin-auth.service.ts';
import type { AdminSessionReader } from '../admin-auth/admin-session-jwt.guard.ts';
import type { StaticToken, StaticTokenStore } from '../sdk-auth/static-token.guard.ts';

export type StoryPlatformSeedConfig = {
  clientId: string;
  clientName: string;
  adminEmail: string;
  adminPassword: string;
};

const DEFAULT_SEED_CONFIG: StoryPlatformSeedConfig = {
  clientId: process.env.OPEN_STORY_CLIENT_ID?.trim() || 'public-client-id',
  clientName: process.env.OPEN_STORY_CLIENT_NAME?.trim() || 'Open Story Client',
  adminEmail: process.env.OPEN_STORY_SEED_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@openstory.local',
  adminPassword: process.env.OPEN_STORY_SEED_ADMIN_PASSWORD?.trim() || 'admin123',
};

export class StoryPlatformRepository implements AdminUserStore, AdminSessionStore, AdminSessionReader, StaticTokenStore {
  private readonly db: DbService;
  private readonly seedConfig: StoryPlatformSeedConfig;

  constructor(
    db: DbService,
    seedConfig: StoryPlatformSeedConfig = DEFAULT_SEED_CONFIG,
  ) {
    this.db = db;
    this.seedConfig = seedConfig;
  }

  getSingletonClient(): ClientRecord {
    this.ensureBootstrapState();

    const clients = this.db
      .list<ClientRecord>('clients')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    if (clients.length !== 1) {
      throw new Error(`Single-tenant invariant violated: expected exactly 1 client, found ${clients.length}.`);
    }

    return clients[0];
  }

  updateSingletonClient(params: { name?: string; isActive?: boolean }): ClientRecord {
    this.ensureBootstrapState();

    const currentClient = this.getSingletonClient();
    const updatedClient = this.db.updateById<ClientRecord>('clients', currentClient.id, {
      name: params.name ?? currentClient.name,
      isActive: params.isActive ?? currentClient.isActive,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedClient) {
      throw new Error('Singleton client could not be updated.');
    }

    return updatedClient;
  }

  listAdminUsers(): AdminUserRecord[] {
    this.ensureBootstrapState();

    return this.db
      .list<AdminUserRecord>('adminUsers')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    return this.findAdminUserByEmail(email);
  }

  findAdminUserByEmail(email: string): AdminUserRecord | null {
    this.ensureBootstrapState();

    return (
      this.db
        .list<AdminUserRecord>('adminUsers')
        .find((user) => user.email === email.trim().toLowerCase()) ?? null
    );
  }

  findAdminUserById(userId: string): AdminUserRecord | null {
    this.ensureBootstrapState();
    return this.db.findById<AdminUserRecord>('adminUsers', userId) ?? null;
  }

  createAdminUser(params: { email: string; role: AdminRole; temporaryPassword: string }): AdminUserRecord {
    this.ensureBootstrapState();

    const email = params.email.trim().toLowerCase();
    const now = new Date().toISOString();

    const existing = this.findAdminUserByEmail(email);
    if (existing) {
      throw new Error(`Admin user already exists for email ${email}.`);
    }

    const record: AdminUserRecord = {
      id: randomUUID(),
      email,
      role: params.role,
      passwordHash: hashPassword(params.temporaryPassword, this.generateSalt()),
      mustChangePassword: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    return this.db.insert<AdminUserRecord>('adminUsers', record);
  }

  updateAdminUserPassword(userId: string, nextPassword: string, mustChangePassword: boolean): AdminUserRecord | null {
    this.ensureBootstrapState();

    return (
      this.db.updateById<AdminUserRecord>('adminUsers', userId, {
        passwordHash: hashPassword(nextPassword, this.generateSalt()),
        mustChangePassword,
        updatedAt: new Date().toISOString(),
      }) ?? null
    );
  }

  updateAdminUserRole(userId: string, role: AdminRole): AdminUserRecord | null {
    this.ensureBootstrapState();

    return (
      this.db.updateById<AdminUserRecord>('adminUsers', userId, {
        role,
        updatedAt: new Date().toISOString(),
      }) ?? null
    );
  }

  listStaticTokens(): StaticTokenRecord[] {
    this.ensureBootstrapState();

    const client = this.getSingletonClient();

    return this.db
      .list<StaticTokenRecord>('staticTokens')
      .filter((token) => token.clientId === client.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  findStaticTokenById(tokenId: string): StaticTokenRecord | null {
    this.ensureBootstrapState();

    const client = this.getSingletonClient();
    const token = this.db.findById<StaticTokenRecord>('staticTokens', tokenId) ?? null;
    if (!token || token.clientId !== client.id) {
      return null;
    }

    return token;
  }

  createStaticToken(params: {
    label: string;
    tokenHash: string;
    tokenPrefix: string;
  }): StaticTokenRecord {
    this.ensureBootstrapState();

    const client = this.getSingletonClient();
    const now = new Date().toISOString();
    const record: StaticTokenRecord = {
      id: randomUUID(),
      clientId: client.id,
      label: params.label,
      tokenHash: params.tokenHash,
      tokenPrefix: params.tokenPrefix,
      isActive: true,
      revokedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.db.insert<StaticTokenRecord>('staticTokens', record);
  }

  revokeStaticToken(tokenId: string, revokedAt = new Date()): StaticTokenRecord | null {
    this.ensureBootstrapState();

    const token = this.findStaticTokenById(tokenId);
    if (!token) {
      return null;
    }

    return (
      this.db.updateById<StaticTokenRecord>('staticTokens', tokenId, {
        isActive: false,
        revokedAt: revokedAt.toISOString(),
        updatedAt: revokedAt.toISOString(),
      }) ?? null
    );
  }

  listAdminApiKeys(): AdminApiKeyRecord[] {
    this.ensureBootstrapState();

    return this.db
      .list<AdminApiKeyRecord>('adminApiKeys')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  findAdminApiKeyById(apiKeyId: string): AdminApiKeyRecord | null {
    this.ensureBootstrapState();
    return this.db.findById<AdminApiKeyRecord>('adminApiKeys', apiKeyId) ?? null;
  }

  createAdminApiKey(params: {
    id: string;
    clientName: string;
    keyPrefix: string;
    clientSecretHash: string;
    createdByAdminUserId: string | null;
  }): AdminApiKeyRecord {
    this.ensureBootstrapState();

    const now = new Date().toISOString();
    const record: AdminApiKeyRecord = {
      id: params.id,
      clientName: params.clientName,
      keyPrefix: params.keyPrefix,
      clientSecretHash: params.clientSecretHash,
      isActive: true,
      revokedAt: null,
      lastUsedAt: null,
      createdByAdminUserId: params.createdByAdminUserId,
      createdAt: now,
      updatedAt: now,
    };

    return this.db.insert<AdminApiKeyRecord>('adminApiKeys', record);
  }

  revokeAdminApiKey(apiKeyId: string, revokedAt = new Date()): AdminApiKeyRecord | null {
    this.ensureBootstrapState();

    const apiKey = this.findAdminApiKeyById(apiKeyId);
    if (!apiKey) {
      return null;
    }

    return (
      this.db.updateById<AdminApiKeyRecord>('adminApiKeys', apiKeyId, {
        isActive: false,
        revokedAt: revokedAt.toISOString(),
        updatedAt: revokedAt.toISOString(),
      }) ?? null
    );
  }

  markAdminApiKeyUsed(apiKeyId: string, usedAt = new Date()): AdminApiKeyRecord | null {
    this.ensureBootstrapState();

    return (
      this.db.updateById<AdminApiKeyRecord>('adminApiKeys', apiKeyId, {
        lastUsedAt: usedAt.toISOString(),
        updatedAt: usedAt.toISOString(),
      }) ?? null
    );
  }

  async create(session: {
    id: string;
    userId: string;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    this.ensureBootstrapState();

    const record: AdminSessionRecord = {
      id: session.id,
      userId: session.userId,
      issuedAt: session.issuedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: null,
    };

    this.db.insert<AdminSessionRecord>('adminSessions', record);
  }

  findAdminSessionById(sessionId: string): AdminSessionRecord | null {
    this.ensureBootstrapState();
    return this.db.findById<AdminSessionRecord>('adminSessions', sessionId) ?? null;
  }

  revokeAdminSession(sessionId: string, revokedAt = new Date()): AdminSessionRecord | null {
    this.ensureBootstrapState();

    return (
      this.db.updateById<AdminSessionRecord>('adminSessions', sessionId, {
        revokedAt: revokedAt.toISOString(),
      }) ?? null
    );
  }

  async isSessionActive(sessionId: string, userId: string, now: Date): Promise<boolean> {
    const session = this.findAdminSessionById(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }

    if (session.revokedAt) {
      return false;
    }

    return new Date(session.expiresAt).getTime() > now.getTime();
  }

  async findByClientId(clientId: string): Promise<StaticToken[]> {
    this.ensureBootstrapState();

    const client = this.getSingletonClient();
    if (client.clientId !== clientId) {
      return [];
    }

    return this.db
      .list<StaticTokenRecord>('staticTokens')
      .filter((token) => token.clientId === client.id)
      .map((token) => ({
        id: token.id,
        clientId: client.clientId,
        tokenHash: token.tokenHash,
        revokedAt: token.revokedAt,
        isActive: token.isActive,
      }));
  }

  private ensureBootstrapState(): void {
    const clients = this.db.list<ClientRecord>('clients');
    if (clients.length === 0) {
      const now = new Date().toISOString();
      this.db.insert<ClientRecord>('clients', {
        id: randomUUID(),
        clientId: this.seedConfig.clientId,
        name: this.seedConfig.clientName,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const adminUsers = this.db.list<AdminUserRecord>('adminUsers');
    if (adminUsers.length === 0) {
      const now = new Date().toISOString();
      this.db.insert<AdminUserRecord>('adminUsers', {
        id: randomUUID(),
        email: this.seedConfig.adminEmail,
        role: 'super_admin',
        passwordHash: hashPassword(this.seedConfig.adminPassword, this.generateSalt()),
        mustChangePassword: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    for (const adminUser of adminUsers) {
      if (!isAdminRole((adminUser as Partial<AdminUserRecord>).role)) {
        this.db.updateById<AdminUserRecord>('adminUsers', adminUser.id, {
          role: 'super_admin',
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  private generateSalt(): string {
    return randomBytes(16).toString('hex');
  }
}

function isAdminRole(role: unknown): role is AdminRole {
  return role === 'super_admin' || role === 'story_admin' || role === 'story_editor';
}
