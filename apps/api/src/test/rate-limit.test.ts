import { describe, expect, it } from 'vitest';
import { makeFakeClient, makeTestEnv, validSuggestionsJson } from './helpers.js';
import { buildApp } from '../app.js';

describe('rate limiting', () => {
  it('rejects requests after the limit with a 429', async () => {
    const env = makeTestEnv({ RATE_LIMIT_MAX: 3, RATE_LIMIT_WINDOW: 60_000 });
    const client = makeFakeClient(async () => ({ output_text: validSuggestionsJson(1) }));
    const app = await buildApp({ env, client });
    try {
      let lastStatus = 0;
      for (let i = 0; i < 4; i += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/comments/generate',
          payload: {
            post: { text: 'Hello' },
            preferences: { tone: 'casual', length: 'short' },
          },
        });
        lastStatus = response.statusCode;
      }
      expect(lastStatus).toBe(429);
      const limited = await app.inject({
        method: 'POST',
        url: '/v1/comments/generate',
        payload: { post: { text: 'Hello' }, preferences: { tone: 'casual', length: 'short' } },
      });
      expect(limited.statusCode).toBe(429);
      expect(limited.json().error.code).toBe('RATE_LIMITED');
    } finally {
      await app.close();
    }
  });

  it('allows /health without rate limiting', async () => {
    const env = makeTestEnv({ RATE_LIMIT_MAX: 1, RATE_LIMIT_WINDOW: 60_000 });
    const app = await buildApp({ env });
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
