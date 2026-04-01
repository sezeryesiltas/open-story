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

const DEFAULT_API_BASE_URL = '';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
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
      ? `API endpoint bulunamadı veya yanlış sunucuya gidildi (${response.status} ${response.statusText}).`
      : `İstek başarısız oldu (${response.status} ${response.statusText}).`;

    throw new ApiRequestError(
      payload?.error?.message ?? fallbackMessage,
      response.status,
      payload?.error?.code,
    );
  }

  return payload as T;
}
