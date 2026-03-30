import type { AuthErrorResponse } from './auth-error-response';

export type HttpResponse = {
  statusCode: number;
  body: AuthErrorResponse;
};

export const toHttpAuthError = (error: AuthErrorResponse): HttpResponse => ({
  statusCode: error.statusCode,
  body: error,
});
