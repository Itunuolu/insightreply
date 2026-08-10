import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { createNetlifyHandler, type NetlifyRequestHandler } from './netlify-handler.js';
import { makeFakeClient, makeTestEnv } from './test/helpers.js';

describe('Netlify function adapter', () => {
  let app: FastifyInstance;
  let handler: NetlifyRequestHandler;

  beforeAll(async () => {
    app = await buildApp({
      env: makeTestEnv({ ALLOWED_EXTENSION_ORIGIN: 'chrome-extension://published-id' }),
      client: makeFakeClient(vi.fn()),
      logger: false,
    });
    handler = createNetlifyHandler(Promise.resolve(app));
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Fastify health route at its public URL', async () => {
    const response = await handler(new Request('https://insightreply.netlify.app/health'), {
      ip: '203.0.113.9',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      service: 'insightreply-api',
    });
  });

  it('preserves CORS preflight headers for the published extension', async () => {
    const response = await handler(
      new Request('https://insightreply.netlify.app/v1/comments/generate', {
        method: 'OPTIONS',
        headers: {
          origin: 'chrome-extension://published-id',
          'access-control-request-method': 'POST',
        },
      }),
      { ip: '203.0.113.9' },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'chrome-extension://published-id',
    );
  });

  it('returns Fastify validation errors through the web-standard response', async () => {
    const response = await handler(
      new Request('https://insightreply.netlify.app/v1/comments/generate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'chrome-extension://published-id',
        },
        body: '{}',
      }),
      { ip: '203.0.113.9' },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});
