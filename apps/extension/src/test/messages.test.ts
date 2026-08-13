import { describe, expect, it } from 'vitest';
import { generateCommentsRequestSchema } from '@insightreply/shared';
import { parseMessage } from '@insightreply/shared';

describe('parseMessage — runtime message validation', () => {
  it('accepts a valid select-post message', () => {
    const message = {
      type: 'IR_SELECT_POST',
      post: {
        postId: 'urn:li:activity:1',
        authorName: 'Ada',
        postText: 'Some post text',
        selectedAt: new Date().toISOString(),
      },
    };
    const result = parseMessage(message);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message.type).toBe('IR_SELECT_POST');
  });

  it('rejects a select-post message with an empty post', () => {
    const result = parseMessage({
      type: 'IR_SELECT_POST',
      post: { postId: '1', postText: '', selectedAt: 'now' },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts a valid insert-comment message', () => {
    const result = parseMessage({
      type: 'IR_INSERT_COMMENT',
      postId: 'urn:li:activity:1',
      text: 'A comment',
      mode: 'auto',
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === 'IR_INSERT_COMMENT') {
      expect(result.message.mode).toBe('auto');
    }
  });

  it('accepts an insert request targeted at a LinkedIn reply editor', () => {
    const result = parseMessage({
      type: 'IR_INSERT_COMMENT',
      postId: 'urn:li:activity:1',
      replyTargetId: 'urn:li:comment:2',
      text: 'A contextual reply',
      mode: 'auto',
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === 'IR_INSERT_COMMENT') {
      expect(result.message.replyTargetId).toBe('urn:li:comment:2');
    }
  });

  it('rejects an insert message with an unknown mode', () => {
    const result = parseMessage({
      type: 'IR_INSERT_COMMENT',
      postId: '1',
      text: 'x',
      mode: 'delete-all',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an insert message with no postId', () => {
    const result = parseMessage({ type: 'IR_INSERT_COMMENT', text: 'x', mode: 'auto' });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown message types', () => {
    const result = parseMessage({ type: 'IR_HACK_THE_PLANET' });
    expect(result.ok).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(parseMessage('hello').ok).toBe(false);
    expect(parseMessage(null).ok).toBe(false);
    expect(parseMessage(undefined).ok).toBe(false);
  });
});

describe('generateCommentsRequestSchema — panel-side payload validation', () => {
  it('accepts the payload the panel builds', () => {
    const input = {
      post: { authorName: 'Ada', text: 'Hello LinkedIn', url: 'https://www.linkedin.com/posts/1' },
      preferences: {
        tone: 'insightful',
        length: 'medium',
        language: 'English',
        emojiPreference: 'none',
        customPerspective: 'Add a product lens',
        writingProfile: '',
        suggestionCount: 3,
      },
    };
    expect(generateCommentsRequestSchema.safeParse(input).success).toBe(true);
  });

  it('accepts the reply payload the panel builds', () => {
    const input = {
      post: { authorName: 'Ada', text: 'Hello LinkedIn' },
      reply: {
        authorName: 'Grace',
        text: 'What changed after launch?',
        parentCommentText: 'The user commented on product iteration.',
      },
      preferences: {
        tone: 'insightful',
        length: 'medium',
        suggestionCount: 3,
      },
    };
    expect(generateCommentsRequestSchema.safeParse(input).success).toBe(true);
  });

  it('rejects a writing profile over 1500 chars', () => {
    const input = {
      post: { text: 'Hello' },
      preferences: {
        tone: 'casual',
        length: 'short',
        writingProfile: 'x'.repeat(1501),
      },
    };
    expect(generateCommentsRequestSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a truncated post flag from storage combined with oversized text', () => {
    const input = {
      post: { text: 'y'.repeat(12_001) },
      preferences: { tone: 'casual', length: 'short' },
    };
    expect(generateCommentsRequestSchema.safeParse(input).success).toBe(false);
  });
});
