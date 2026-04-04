import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DbService } from '@open-story/db';

import { AdminAccessService } from '../src/admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../src/admin-auth/simple-jwt.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { ClientService } from '../src/modules/client/client.service.ts';
import { ClientTokenService } from '../src/modules/client-token/client-token.service.ts';
import { StaticTokenGuard } from '../src/sdk-auth/static-token.guard.ts';
import { StoryPlatformRepository } from '../src/story-platform/story-platform.repository.ts';

function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-api-client-'));

  process.env.OPEN_STORY_SQLITE_PATH = join(tempDir, 'open-story.sqlite');
  process.env.OPEN_STORY_DB_CONFIG_PATH = join(tempDir, 'database-config.json');

  const db = new DbService();
  const repository = new StoryPlatformRepository(db, {
    clientId: 'public-client-id',
    clientName: 'Open Story App',
    adminEmail: 'admin@openstory.local',
    adminPassword: 'admin12345',
  });
  const jwtService = new SimpleJwtService('test-admin-jwt-secret');
  const adminAccessService = new AdminAccessService(repository, jwtService);

  return {
    repository,
    authService: new AuthService(repository, jwtService, adminAccessService),
    clientService: new ClientService(repository, adminAccessService),
    clientTokenService: new ClientTokenService(repository, adminAccessService),
  };
}

test('client management returns and updates the singleton client', async () => {
  const { authService, clientService } = createHarness();

  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;

  const client = await clientService.get(authorization);
  assert.equal(client.clientId, 'public-client-id');
  assert.equal(client.name, 'Open Story App');
  assert.equal(client.isActive, true);

  const updatedClient = await clientService.update(
    {
      name: 'Updated Story App',
      isActive: false,
    },
    authorization,
  );

  assert.equal(updatedClient.name, 'Updated Story App');
  assert.equal(updatedClient.isActive, false);
});

test('static token management lists, creates, validates and revokes tokens', async () => {
  const { authService, clientTokenService, repository } = createHarness();

  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;

  const initialTokens = await clientTokenService.list(authorization);
  assert.equal(initialTokens.length, 0);

  const createdToken = await clientTokenService.create(
    {
      label: 'iOS QA Token',
    },
    authorization,
  );

  assert.equal(createdToken.token.clientId, 'public-client-id');
  assert.equal(createdToken.token.label, 'iOS QA Token');
  assert.equal(createdToken.plainTextToken.startsWith(createdToken.token.tokenPrefix), true);

  const listedTokens = await clientTokenService.list(authorization);
  assert.equal(listedTokens.length, 1);
  assert.equal(listedTokens[0].label, 'iOS QA Token');

  const activeGuardResult = await new StaticTokenGuard(repository).validateRequest({
    headers: {
      authorization: `Bearer ${createdToken.plainTextToken}`,
    },
    body: {
      client_id: 'public-client-id',
    },
  });

  assert.equal(activeGuardResult.ok, true);

  const revokedToken = await clientTokenService.revoke(
    createdToken.token.id,
    {
      reason: 'rotated',
    },
    authorization,
  );
  assert.equal(revokedToken.isActive, false);
  assert.notEqual(revokedToken.revokedAt, null);

  const revokedGuardResult = await new StaticTokenGuard(repository).validateRequest({
    headers: {
      authorization: `Bearer ${createdToken.plainTextToken}`,
    },
    body: {
      client_id: 'public-client-id',
    },
  });

  assert.equal(revokedGuardResult.ok, false);
  if (!revokedGuardResult.ok) {
    assert.equal(revokedGuardResult.error.statusCode, 403);
  }
});
