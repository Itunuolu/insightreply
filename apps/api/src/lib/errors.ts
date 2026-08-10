import type { FastifyError, FastifyInstance } from 'fastify';
import type { ApiErrorCode } from '../errors.js';
import { ApiError, httpStatusFor } from '../errors.js';

/**
 * Central error handler. Never leaks stack traces or internal API error
 * messages to the client, and never logs post content (the request body is
 * not logged anywhere).
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | ApiError, request, reply) => {
    const requestId =
      typeof request.id === 'string' ? request.id : `req_${Date.now().toString(36)}`;

    if (err instanceof ApiError) {
      const cause =
        err.cause && typeof err.cause === 'object'
          ? (err.cause as Record<string, unknown>)
          : undefined;
      request.log.warn(
        {
          errCode: err.code,
          requestId,
          upstream: cause
            ? {
                name: err.cause instanceof Error ? err.cause.name : undefined,
                status: typeof cause.status === 'number' ? cause.status : undefined,
                code: typeof cause.code === 'string' ? cause.code : undefined,
                type: typeof cause.type === 'string' ? cause.type : undefined,
                param: typeof cause.param === 'string' ? cause.param : undefined,
              }
            : undefined,
        },
        'request failed',
      );
      return reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.publicMessage,
          requestId,
        },
      });
    }

    if ('validation' in err && err.validation) {
      const details = (err.validation as Array<{ message?: string }>)
        .map((v) => v.message)
        .filter(Boolean)
        .join('; ');
      request.log.warn({ requestId }, 'validation error');
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR' as ApiErrorCode,
          message: details || 'The request payload is invalid.',
          requestId,
        },
      });
    }

    if ('statusCode' in err && typeof err.statusCode === 'number' && err.statusCode === 404) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Route not found.', requestId },
      });
    }

    // @fastify/rate-limit v10 throws the errorResponseBuilder result as an
    // error; reply with it verbatim when it carries a status code.
    if (
      err &&
      typeof err === 'object' &&
      !(err instanceof Error) &&
      'statusCode' in err &&
      typeof (err as { statusCode?: unknown }).statusCode === 'number'
    ) {
      const statusCode = (err as { statusCode?: unknown }).statusCode as number;
      if (statusCode >= 400 && statusCode < 600) {
        return reply.status(statusCode).send(err);
      }
    }

    request.log.error(
      {
        err: err instanceof Error ? { name: err.name, message: err.message } : err,
        requestId,
      },
      'unhandled error',
    );
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR' as ApiErrorCode,
        message: 'Something went wrong on our side. Please try again.',
        requestId,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    const requestId =
      typeof request.id === 'string' ? request.id : `req_${Date.now().toString(36)}`;
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Route not found.', requestId },
    });
  });
}

export { httpStatusFor };
