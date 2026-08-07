import type { LoggerOptions } from 'pino';

export type AppLogger = import('pino').Logger;

/** pino configuration object consumed by Fastify's logger option. */
export interface FastifyLoggerConfig extends LoggerOptions {
  level: string;
}

export function createLogger(level: string): FastifyLoggerConfig {
  return {
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        '*.apiKey',
        '*.OPENAI_API_KEY',
      ],
      censor: '[redacted]',
    },
    base: undefined,
    ...(process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
  };
}

/**
 * Serializers deliberately drop request bodies and anything that could contain
 * post content, so full LinkedIn posts never reach the logs.
 */
export function requestLogSerializer(req: { method: string; url: string; id?: unknown }): Record<string, unknown> {
  return { method: req.method, url: req.url, requestId: req.id };
}

export function responseLogSerializer(res: { statusCode: number }): Record<string, unknown> {
  return { statusCode: res.statusCode };
}