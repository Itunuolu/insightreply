import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../ai/prompt.js';
import { validReplyRequest } from './helpers.js';

describe('reply prompt priority', () => {
  it('makes an appreciative incoming reply primary and the post supporting context', () => {
    const prompt = buildPrompt({
      ...validReplyRequest(),
      reply: {
        authorName: 'Oyindamola Oye-Daniel',
        text: 'Amazing, thanks for this beautiful contribution 🙏',
        parentCommentAuthorName: 'Itunuoluwa Akinkugbe',
        parentCommentText:
          'Leadership impact should include what a leader enables other people to achieve.',
      },
    });

    const primaryIndex = prompt.input.indexOf('<primary_incoming_reply_to_answer>');
    const contextIndex = prompt.input.indexOf(
      '<supporting_conversation_context_do_not_answer_instead_of_primary_reply>',
    );

    expect(primaryIndex).toBeGreaterThanOrEqual(0);
    expect(contextIndex).toBeGreaterThan(primaryIndex);
    expect(prompt.input).toContain('Author: Oyindamola Oye-Daniel');
    expect(prompt.input).toContain('Message: Amazing, thanks for this beautiful contribution 🙏');
    expect(prompt.input).toContain('expresses appreciation or praise');
    expect(prompt.input).toContain('Every suggestion must directly answer');
    expect(prompt.instructions).toContain('PRIMARY message to answer');
    expect(prompt.jsonSchema).toMatchObject({
      properties: {
        suggestions: {
          items: {
            properties: {
              text: {
                description: expect.stringContaining('direct response to primary_incoming_reply'),
              },
            },
          },
        },
      },
    });
  });

  it('tells the model to answer a question before using supporting context', () => {
    const prompt = buildPrompt(validReplyRequest());
    expect(prompt.input).toContain('asks a question');
    expect(prompt.input).toContain('Answer or directly engage that question');
  });
});
