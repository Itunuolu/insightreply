export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'POST_TOO_LONG'
  | 'AI_UPSTREAM_ERROR'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_OUTPUT'
  | 'AI_REFUSED'
  | 'GENERATION_REJECTED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  public readonly upstreamCause?: unknown;

  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly publicMessage: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.upstreamCause = cause;
  }
}

export function httpStatusFor(code: ApiErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'POST_TOO_LONG':
      return 400;
    case 'RATE_LIMITED':
      return 429;
    case 'NOT_FOUND':
      return 404;
    case 'METHOD_NOT_ALLOWED':
      return 405;
    case 'AI_UPSTREAM_ERROR':
    case 'AI_TIMEOUT':
      return 502;
    case 'AI_INVALID_OUTPUT':
    case 'AI_REFUSED':
    case 'GENERATION_REJECTED':
      return 422;
    default:
      return 500;
  }
}
