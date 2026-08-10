import type { FastifyInstance, InjectOptions } from 'fastify';

export interface NetlifyRequestContext {
  /** Netlify-authenticated client address, used by the API rate limiter. */
  ip?: string;
}

export type NetlifyRequestHandler = (
  request: Request,
  context: NetlifyRequestContext,
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
 * Adapts Netlify's web-standard Request/Response function API to Fastify's
 * in-process injection API. The Fastify app is reused across warm invocations.
 */
export function createNetlifyHandler(appPromise: Promise<FastifyInstance>): NetlifyRequestHandler {
  return async (request, context) => {
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
