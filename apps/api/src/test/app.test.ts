import { describe, expect, it } from 'vitest';
import {
  makeFakeClient,
  makeTestEnv,
  validReplyRequest,
  validRequest,
  validSuggestionsJson,
} from './helpers.js';
import { buildApp } from '../app.js';

describe('HTTP API', () => {
  it('GET /health returns ok', async () => {
    const app = await buildApp({ env: makeTestEnv() });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    await app.close();
  });

  it('rejects a request with no post text', async () => {
    const app = await buildApp({ env: makeTestEnv() });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: { post: { text: '' }, preferences: { tone: 'casual', length: 'short' } },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(body)).not.toContain('test-key');
    await app.close();
  });

  it('rejects a post above the maximum length', async () => {
    const app = await buildApp({ env: makeTestEnv() });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: {
        post: { text: 'x'.repeat(12_001) },
        preferences: { tone: 'casual', length: 'short' },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('rejects an oversized perspective field', async () => {
    const app = await buildApp({ env: makeTestEnv() });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: {
        post: { text: 'Hello world' },
        preferences: {
          tone: 'casual',
          length: 'short',
          customPerspective: 'y'.repeat(501),
        },
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects an invalid tone', async () => {
    const app = await buildApp({ env: makeTestEnv() });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: {
        post: { text: 'Hello world' },
        preferences: { tone: 'hostile', length: 'short' },
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('generates comments end to end with a mocked model client', async () => {
    const client = makeFakeClient(async () => ({
      output_text: validSuggestionsJson(3),
    }));
    const env = makeTestEnv();
    const app = await buildApp({ env, client });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: validRequest(),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.requestId).toBeTruthy();
    expect(body.postSummary).toBeTruthy();
    expect(body.suggestions).toHaveLength(3);
    expect(body.suggestions[0]).toMatchObject({ id: expect.any(String), text: expect.any(String) });
    await app.close();
  });

  it('generates contextual replies through the same backward-compatible endpoint', async () => {
    let modelInput = '';
    const client = makeFakeClient(async (params) => {
      modelInput = String(params.input ?? '');
      return { output_text: validSuggestionsJson(3) };
    });
    const app = await buildApp({ env: makeTestEnv(), client });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: validReplyRequest(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().suggestions).toHaveLength(3);
    expect(modelInput).toContain('selected_linkedin_reply_context');
    expect(modelInput).toContain('What changed in the product');
    expect(modelInput).toContain('Task: Write a reply');
    await app.close();
  });

  it('returns a safe 422 when the model output is invalid', async () => {
    const client = makeFakeClient(async () => ({ output_text: 'not json at all' }));
    const env = makeTestEnv();
    const app = await buildApp({ env, client });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: validRequest(),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('AI_INVALID_OUTPUT');
    await app.close();
  });

  it('does not leak the OpenAI key or post text into errors', async () => {
    const client = makeFakeClient(async () => {
      throw new Error('boom: post content here should never leak');
    });
    const env = makeTestEnv({ OPENAI_API_KEY: 'super-secret-key' });
    const app = await buildApp({ env, client });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/comments/generate',
      payload: validRequest(),
    });
    const body = JSON.stringify(response.json());
    expect(body).not.toContain('super-secret-key');
    expect(body).not.toContain('analytics dashboard');
    expect(response.statusCode).toBe(502);
    await app.close();
  });

  it('returns 404 for unknown routes', async () => {
    const app = await buildApp({ env: makeTestEnv() });
    const response = await app.inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });
});

describe('CORS origin allow-list', () => {
  const DEV = 'chrome-extension://devidaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const PUBLISHED = 'chrome-extension://publishedbbbbbbbbbbbbbbbbbbbbbbb';

  const preflight = (app: Awaited<ReturnType<typeof buildApp>>, origin: string) =>
    app.inject({
      method: 'OPTIONS',
      url: '/v1/comments/generate',
      headers: { origin, 'access-control-request-method': 'POST' },
    });

  it('accepts every origin in a comma-separated list', async () => {
    const app = await buildApp({ env: makeTestEnv({ ALLOWED_EXTENSION_ORIGIN: `${DEV},${PUBLISHED}` }) });
    for (const origin of [DEV, PUBLISHED]) {
      expect((await preflight(app, origin)).headers['access-control-allow-origin']).toBe(origin);
    }
    await app.close();
  });

  it('tolerates whitespace and trailing slashes in the list', async () => {
    const app = await buildApp({
      env: makeTestEnv({ ALLOWED_EXTENSION_ORIGIN: `  ${DEV}/ ,  ${PUBLISHED}  ` }),
    });
    expect((await preflight(app, DEV)).headers['access-control-allow-origin']).toBe(DEV);
    await app.close();
  });

  it('rejects an origin that is not listed', async () => {
    const app = await buildApp({ env: makeTestEnv({ ALLOWED_EXTENSION_ORIGIN: DEV }) });
    expect((await preflight(app, PUBLISHED)).headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });
});
