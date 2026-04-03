import { randomBytes, randomUUID } from 'node:crypto';

import type {
  AdminSessionRecord,
  AdminUserRecord,
  ClientRecord,
} from '@open-story/contracts';
import { DbService } from '@open-story/db';

import { hashPassword } from '../admin-auth/password.ts';
import type { AdminSessionStore, AdminUserStore } from '../admin-auth/admin-auth.service.ts';
import type { AdminSessionReader } from '../admin-auth/admin-session-jwt.guard.ts';

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

export class StoryPlatformRepository implements AdminUserStore, AdminSessionStore, AdminSessionReader {
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

  createAdminUser(params: { email: string; temporaryPassword: string }): AdminUserRecord {
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
        passwordHash: hashPassword(this.seedConfig.adminPassword, this.generateSalt()),
        mustChangePassword: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private generateSalt(): string {
    return randomBytes(16).toString('hex');
  }
}
