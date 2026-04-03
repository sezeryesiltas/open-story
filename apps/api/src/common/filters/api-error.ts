export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'not_found'
  | 'conflict';

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export class ApiServiceError extends Error {
  readonly statusCode: 400 | 401 | 403 | 404 | 409;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    statusCode: 400 | 401 | 403 | 404 | 409,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiServiceError {
    return new ApiServiceError(400, 'validation_error', message, details);
  }

  static unauthorized(message: string, details?: unknown): ApiServiceError {
    return new ApiServiceError(401, 'unauthorized', message, details);
  }

  static forbidden(message: string, details?: unknown): ApiServiceError {
    return new ApiServiceError(403, 'forbidden', message, details);
  }

  static notFound(message: string, details?: unknown): ApiServiceError {
    return new ApiServiceError(404, 'not_found', message, details);
  }

  static conflict(message: string, details?: unknown): ApiServiceError {
    return new ApiServiceError(409, 'conflict', message, details);
  }
}
