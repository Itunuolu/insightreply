import { describe, expect, it, vi } from 'vitest';
import { CommentGenerator } from '../ai/comment-generator.js';
import { ApiError } from '../errors.js';
import { makeFakeClient, validRequest, validSuggestionsJson } from './helpers.js';

describe('CommentGenerator', () => {
  it('parses a valid structured response into suggestions', async () => {
    const client = makeFakeClient(async () => ({ output_text: validSuggestionsJson(3) }));
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    const result = await generator.generate(validRequest());
    expect(result.suggestions).toHaveLength(3);
    expect(result.repaired).toBe(false);
  });

  it('recovers from an invalid response with one controlled repair call', async () => {
    const calls = vi.fn();
    const client = makeFakeClient(async () => {
      calls();
      if (calls.mock.calls.length === 1) return { output_text: 'not json' };
      return { output_text: validSuggestionsJson(3) };
    });
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    const result = await generator.generate(validRequest());
    expect(calls).toHaveBeenCalledTimes(2);
    expect(result.suggestions).toHaveLength(3);
    expect(result.repaired).toBe(true);
  });

  it('does not loop indefinitely on persistent invalid output', async () => {
    const client = makeFakeClient(async () => ({ output_text: 'still not json' }));
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    await expect(generator.generate(validRequest())).rejects.toMatchObject({
      code: 'AI_INVALID_OUTPUT',
    });
  });

  it('maps a refusal to AI_REFUSED', async () => {
    const client = makeFakeClient(async () => ({ output_text: '', refusal: 'refused' }));
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    await expect(generator.generate(validRequest())).rejects.toMatchObject({
      code: 'AI_REFUSED',
    });
  });

  it('maps an invalid error code to AI_UPSTREAM_ERROR', async () => {
    const client = makeFakeClient(async () => {
      throw Object.assign(new Error('nope'), { status: 500 });
    });
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    await expect(generator.generate(validRequest())).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
    });
  });

  it('propagates rate limiting from the provider', async () => {
    const client = makeFakeClient(async () => {
      throw Object.assign(new Error('rate limited'), { status: 429 });
    });
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    await expect(generator.generate(validRequest())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('rejects generic suggestions via the quality gate', async () => {
    const genericJson = JSON.stringify({
      postSummary: 'summary',
      suggestions: [
        { tone: 'professional', text: 'Great post. Absolutely agree with everything!' },
        { tone: 'professional', text: 'Great post. Absolutely agree with everything!' },
        { tone: 'professional', text: 'Great post. Absolutely agree with everything!' },
      ],
    });
    const client = makeFakeClient(async () => ({ output_text: genericJson }));
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    await expect(generator.generate(validRequest())).rejects.toMatchObject({
      code: 'GENERATION_REJECTED',
    });
  });

  it('trims suggestions down to the requested count', async () => {
    const client = makeFakeClient(async () => ({ output_text: validSuggestionsJson(4) }));
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    const result = await generator.generate({ ...validRequest(), preferences: { ...validRequest().preferences, suggestionCount: 3 } });
    expect(result.suggestions).toHaveLength(3);
  });

  it('exposes an ApiError with a public message that hides internals', async () => {
    const client = makeFakeClient(async () => ({ output_text: 'invalid' }));
    const generator = new CommentGenerator({ client, model: 'gpt-test' });
    try {
      await generator.generate(validRequest());
      expect.unreachable();
    } catch (err) {
      const apiError = err as ApiError;
      expect(apiError.publicMessage).not.toContain('OpenAI');
      expect(apiError.publicMessage.length).toBeGreaterThan(10);
    }
  });
});