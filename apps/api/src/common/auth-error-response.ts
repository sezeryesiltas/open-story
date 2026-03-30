export type AuthErrorCode =
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN'
  | 'TOKEN_REVOKED'
  | 'TOKEN_CLIENT_MISMATCH';

export type AuthErrorResponse = {
  statusCode: 401 | 403;
  error: 'Unauthorized' | 'Forbidden';
  code: AuthErrorCode;
  message: string;
};

export const unauthorized = (
  code: Extract<AuthErrorCode, 'AUTH_UNAUTHORIZED'>,
  message = 'Authentication is required to access this resource.',
): AuthErrorResponse => ({
  statusCode: 401,
  error: 'Unauthorized',
  code,
  message,
});

export const forbidden = (
  code: Exclude<AuthErrorCode, 'AUTH_UNAUTHORIZED'>,
  message = 'You do not have permission to access this resource.',
): AuthErrorResponse => ({
  statusCode: 403,
  error: 'Forbidden',
  code,
  message,
});
