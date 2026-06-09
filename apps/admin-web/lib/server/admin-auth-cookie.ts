export const ADMIN_AUTH_COOKIE_NAME = 'open_story_admin_access_token';

export function shouldExpireAdminAuthCookie(status: number): boolean {
  return status === 401 || status === 403;
}

export function getExpiredAdminAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.OPEN_STORY_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  };
}
