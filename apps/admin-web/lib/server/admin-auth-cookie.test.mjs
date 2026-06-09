import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADMIN_AUTH_COOKIE_NAME,
  getExpiredAdminAuthCookieOptions,
  shouldExpireAdminAuthCookie,
} from './admin-auth-cookie.ts';

test('admin auth cookie expiry is only triggered for auth failures', () => {
  assert.equal(shouldExpireAdminAuthCookie(401), true);
  assert.equal(shouldExpireAdminAuthCookie(403), true);
  assert.equal(shouldExpireAdminAuthCookie(400), false);
});

test('expired admin auth cookie options immediately invalidate the cookie', () => {
  const options = getExpiredAdminAuthCookieOptions();

  assert.equal(ADMIN_AUTH_COOKIE_NAME, 'open_story_admin_access_token');
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
  assert.equal(options.expires.getTime(), 0);
});
