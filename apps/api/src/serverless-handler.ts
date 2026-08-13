import type { FastifyInstance, InjectOptions } from 'fastify';

export interface ServerlessRequestContext {
  /** Provider-authenticated client address, used by the API rate limiter. */
  ip?: string;
}

export type ServerlessRequestHandler = (
  request: Request,
  context?: ServerlessRequestContext,
) => Promise<Response>;

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Adapts a web-standard serverless Request/Response API to Fastify's
 * in-process injection API. The Fastify app is reused across warm invocations.
 */
export function createServerlessHandler(
  appPromise: Promise<FastifyInstance>,
): ServerlessRequestHandler {
  return async (request, context = {}) => {
    const app = await appPromise;
    const incomingUrl = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());
    const payload = BODYLESS_METHODS.has(request.method)
      ? undefined
      : Buffer.from(await request.arrayBuffer());

    const injectOptions: InjectOptions = {
      method: request.method as InjectOptions['method'],
      url: `${incomingUrl.pathname}${incomingUrl.search}`,
      headers,
      payload,
      remoteAddress: context.ip || '127.0.0.1',
    };
    const injected = await app.inject(injectOptions);

    const outgoingHeaders = new Headers();
    for (const [name, value] of Object.entries(injected.headers)) {
      if (value === undefined || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
      if (Array.isArray(value)) {
        for (const item of value) outgoingHeaders.append(name, String(item));
      } else {
        outgoingHeaders.set(name, String(value));
      }
    }

    const responseHasNoBody =
      request.method === 'HEAD' || [101, 204, 205, 304].includes(injected.statusCode);

    return new Response(responseHasNoBody ? null : injected.body, {
      status: injected.statusCode,
      headers: outgoingHeaders,
    });
  };
}

export function forwardedClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded
    ?.split(',')
    .map((value) => value.trim())
    .find(Boolean);
}
