import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { DbService } from '@open-story/db';

import { AdminAccessService } from '../src/admin-auth/admin-access.service.ts';
import { SimpleJwtService } from '../src/admin-auth/simple-jwt.ts';
import { ApiServiceError } from '../src/common/filters/api-error.ts';
import { AdminUserService } from '../src/modules/admin-user/admin-user.service.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { StoryPlatformRepository } from '../src/story-platform/story-platform.repository.ts';

function createHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), 'open-story-api-auth-'));

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
    adminUserService: new AdminUserService(repository, adminAccessService),
  };
}

test('repository bootstrap seeds a single client and admin user', () => {
  const { repository } = createHarness();

  const client = repository.getSingletonClient();
  const users = repository.listAdminUsers();

  assert.equal(client.clientId, 'public-client-id');
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'admin@openstory.local');
  assert.equal(users[0].role, 'super_admin');
  assert.equal(users[0].mustChangePassword, true);
});

test('auth flow supports login, me, change password and logout', async () => {
  const { authService } = createHarness();

  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });

  assert.equal(Boolean(loginResponse.accessToken), true);
  assert.equal(loginResponse.user.role, 'super_admin');
  assert.equal(loginResponse.user.mustChangePassword, true);

  const authorization = `Bearer ${loginResponse.accessToken}`;
  const meResponse = await authService.me(authorization);
  assert.equal(meResponse.user.email, 'admin@openstory.local');
  assert.equal(meResponse.user.role, 'super_admin');

  const passwordChanged = await authService.changePassword(
    {
      currentPassword: 'admin12345',
      newPassword: 'new-admin-password',
    },
    authorization,
  );
  assert.equal(passwordChanged.user.mustChangePassword, false);

  await authService.logout(authorization);

  await assert.rejects(
    () => authService.me(authorization),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 403 &&
      error.code === 'forbidden',
  );
});

test('admin user management lists, creates and resets admin users', async () => {
  const { authService, adminUserService } = createHarness();

  const loginResponse = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const authorization = `Bearer ${loginResponse.accessToken}`;

  const beforeUsers = await adminUserService.list(authorization);
  assert.equal(beforeUsers.length, 1);

  const createdUser = await adminUserService.create(
    {
      email: 'editor@openstory.local',
      role: 'story_editor',
      temporaryPassword: 'temporary123',
    },
    authorization,
  );

  assert.equal(createdUser.email, 'editor@openstory.local');
  assert.equal(createdUser.role, 'story_editor');
  assert.equal(createdUser.mustChangePassword, true);

  const resetUser = await adminUserService.resetPassword(
    createdUser.id,
    { temporaryPassword: 'temporary456' },
    authorization,
  );

  assert.equal(resetUser.id, createdUser.id);
  assert.equal(resetUser.mustChangePassword, true);

  const afterUsers = await adminUserService.list(authorization);
  assert.equal(afterUsers.length, 2);
});

test('admin user management requires a super admin role', async () => {
  const { authService, adminUserService } = createHarness();

  const superAdminLogin = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const superAdminAuthorization = `Bearer ${superAdminLogin.accessToken}`;

  await adminUserService.create(
    {
      email: 'story-admin@openstory.local',
      role: 'story_admin',
      temporaryPassword: 'temporary123',
    },
    superAdminAuthorization,
  );

  const storyAdminLogin = await authService.login({
    email: 'story-admin@openstory.local',
    password: 'temporary123',
  });
  const storyAdminAuthorization = `Bearer ${storyAdminLogin.accessToken}`;

  await assert.rejects(
    () => adminUserService.list(storyAdminAuthorization),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 403 &&
      error.code === 'forbidden',
  );
});

test('super admin can update another admin role but not their own role', async () => {
  const { authService, adminUserService } = createHarness();

  const superAdminLogin = await authService.login({
    email: 'admin@openstory.local',
    password: 'admin12345',
  });
  const superAdminAuthorization = `Bearer ${superAdminLogin.accessToken}`;

  const createdUser = await adminUserService.create(
    {
      email: 'editor@openstory.local',
      role: 'story_editor',
      temporaryPassword: 'temporary123',
    },
    superAdminAuthorization,
  );

  const updatedUser = await adminUserService.updateRole(
    createdUser.id,
    { role: 'story_admin' },
    superAdminAuthorization,
  );

  assert.equal(updatedUser.id, createdUser.id);
  assert.equal(updatedUser.role, 'story_admin');

  await assert.rejects(
    () =>
      adminUserService.updateRole(
        superAdminLogin.user.id,
        { role: 'story_editor' },
        superAdminAuthorization,
      ),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 403 &&
      error.code === 'forbidden',
  );

  const storyAdminLogin = await authService.login({
    email: 'editor@openstory.local',
    password: 'temporary123',
  });

  await assert.rejects(
    () =>
      adminUserService.updateRole(
        superAdminLogin.user.id,
        { role: 'story_admin' },
        `Bearer ${storyAdminLogin.accessToken}`,
      ),
    (error) =>
      error instanceof ApiServiceError &&
      error.statusCode === 403 &&
      error.code === 'forbidden',
  );
});
