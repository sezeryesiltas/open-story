export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const ADMIN_AUTH_EXPIRED_EVENT = 'open-story-admin-auth-expired';
export const DEFAULT_ADMIN_AUTH_EXPIRED_MESSAGE =
  'Your session expired. Please sign in again to continue.';

export type AdminAuthExpiredEventDetail = {
  message: string;
  status: 401 | 403;
};

export type ApiRequestInit = RequestInit & {
  suppressAuthRedirect?: boolean;
};

export function isApiAuthError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

export function shouldRetryApiRequest(failureCount: number, error: unknown): boolean {
  if (isApiAuthError(error)) {
    return false;
  }

  return failureCount < 1;
}

function dispatchAdminAuthExpired(detail: AdminAuthExpiredEventDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AdminAuthExpiredEventDetail>(ADMIN_AUTH_EXPIRED_EVENT, {
      detail,
    }),
  );
}

export async function apiRequest<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const { suppressAuthRedirect = false, ...requestInit } = init ?? {};
  const headers = new Headers(requestInit.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...requestInit,
    cache: 'no-store',
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json().catch(() => null)) as
        | {
            error?: {
              code?: string;
              message?: string;
            };
          }
        | null)
    : null;

  if (!response.ok) {
    const fallbackMessage = contentType.includes('text/html')
      ? `API endpoint was not found or the request reached the wrong server (${response.status} ${response.statusText}).`
      : `Request failed (${response.status} ${response.statusText}).`;

    const error = new ApiRequestError(
      payload?.error?.message ?? fallbackMessage,
      response.status,
      payload?.error?.code,
    );

    if (!suppressAuthRedirect && isApiAuthError(error)) {
      dispatchAdminAuthExpired({
        message: DEFAULT_ADMIN_AUTH_EXPIRED_MESSAGE,
        status: error.status as 401 | 403,
      });
    }

    throw error;
  }

  return payload as T;
}
