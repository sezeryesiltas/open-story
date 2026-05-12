import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export const ADMIN_AUTH_COOKIE_NAME = 'open_story_admin_access_token';

type BackendErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class BackendApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
    this.code = code;
  }
}

type BackendApiRequestOptions = {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
  authToken?: string | null;
  contentType?: string | null;
  duplex?: 'half';
};

const DEFAULT_BACKEND_API_BASE_URL = 'http://localhost:3001';

export function getBackendApiBaseUrl(): string {
  return (
    process.env.OPEN_STORY_API_BASE_URL?.trim() ||
    DEFAULT_BACKEND_API_BASE_URL
  ).replace(/\/+$/, '');
}

export function getAdminAuthTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getAdminAuthTokenFromCookies(): Promise<string | null> {
  return (await cookies()).get(ADMIN_AUTH_COOKIE_NAME)?.value ?? null;
}

export async function backendApiRequest<T>(
  path: string,
  options: BackendApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.authToken) {
    headers.set('Authorization', `Bearer ${options.authToken}`);
  }

  if (options.contentType !== null && !headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', options.contentType ?? 'application/json');
  }

  let response: Response;

  try {
    const requestInit: RequestInit & { duplex?: 'half' } = {
      method: options.method ?? 'GET',
      body: options.body,
      headers,
      cache: 'no-store',
      duplex: options.duplex,
    };

    response = await fetch(`${getBackendApiBaseUrl()}${path}`, requestInit);
  } catch {
    throw new BackendApiError(
      `Backend service could not be reached: ${getBackendApiBaseUrl()}. The API service may not be running.`,
      503,
      'backend_unreachable',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json().catch(() => null)) as BackendErrorPayload | T | null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const errorPayload = typeof payload === 'object' && payload !== null ? (payload as BackendErrorPayload) : null;
    const fallbackMessage =
      typeof payload === 'string' && payload.trim()
        ? payload
        : `Backend request failed (${response.status} ${response.statusText}).`;
    const safeMessage =
      response.status === 404 && typeof payload === 'string' && payload.includes('<!DOCTYPE html>')
        ? `Backend endpoint was not found: ${getBackendApiBaseUrl()}${path}. The API service may not be running, or the request is using the wrong port.`
        : fallbackMessage;

    throw new BackendApiError(
      errorPayload?.error?.message ?? safeMessage,
      response.status,
      errorPayload?.error?.code,
    );
  }

  return payload as T;
}

export async function backendApiRequestFromRoute<T>(
  request: NextRequest,
  path: string,
  options: Omit<BackendApiRequestOptions, 'authToken'> = {},
): Promise<T> {
  return backendApiRequest<T>(path, {
    ...options,
    authToken: getAdminAuthTokenFromRequest(request),
  });
}
