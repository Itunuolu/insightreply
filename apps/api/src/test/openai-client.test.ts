import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAiClient } from '../app.js';

describe('OpenAI-compatible chat adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends DeepSeek JSON and thinking options without an undefined timeout', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'chatcmpl_test',
          object: 'chat.completion',
          created: 1,
          model: 'deepseek-v4-pro',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: '{"ok":true}' },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = createOpenAiClient(
      'test-key',
      'https://api.deepseek.com',
      'chat',
      'json_object',
      'disabled',
    );
    const result = await client.responses.create({
      model: 'deepseek-v4-pro',
      instructions: 'Return JSON only.',
      input: 'Return an object.',
      text: {
        format: {
          type: 'json_schema',
          name: 'test_output',
          strict: true,
          schema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
            additionalProperties: false,
          },
        },
      },
    });

    expect(result.output_text).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, requestInit] = fetchMock.mock.calls[0]!;
    expect(typeof requestInit?.body).toBe('string');
    const body = JSON.parse(requestInit?.body as string);
    expect(body).toMatchObject({
      model: 'deepseek-v4-pro',
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    });
  });
});
