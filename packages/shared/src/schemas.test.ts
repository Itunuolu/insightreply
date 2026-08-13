import { describe, expect, it } from 'vitest';
import {
  generateCommentsRequestSchema,
  generateCommentsResponseSchema,
  MAX_PERSPECTIVE_LENGTH,
  MAX_POST_LENGTH,
  selectedPostSchema,
} from './schemas.js';

describe('generateCommentsRequestSchema', () => {
  it('accepts a valid request', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { authorName: 'Ada Lovelace', text: 'We shipped v2 today.' },
      preferences: {
        tone: 'insightful',
        length: 'medium',
        suggestionCount: 3,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing post text', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { authorName: 'Ada', text: '' },
      preferences: { tone: 'casual', length: 'short' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a post above the maximum length', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { text: 'x'.repeat(MAX_POST_LENGTH + 1) },
      preferences: { tone: 'casual', length: 'short' },
    });
    expect(result.success).toBe(false);
    expect(result.success || '').not.toContain('x');
  });

  it('rejects an oversized perspective', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { text: 'Hello' },
      preferences: {
        tone: 'casual',
        length: 'short',
        customPerspective: 'y'.repeat(MAX_PERSPECTIVE_LENGTH + 1),
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid tone', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { text: 'Hello' },
      preferences: { tone: 'aggressive', length: 'short' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range suggestion count', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { text: 'Hello' },
      preferences: { tone: 'casual', length: 'short', suggestionCount: 9 },
    });
    expect(result.success).toBe(false);
  });

  it('defaults suggestion count to 3', () => {
    const result = generateCommentsRequestSchema.parse({
      post: { text: 'Hello' },
      preferences: { tone: 'casual', length: 'short' },
    });
    expect(result.preferences.suggestionCount).toBe(3);
  });

  it('accepts reply context alongside the original post', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { authorName: 'Ada', text: 'A post about product discovery.' },
      reply: {
        authorName: 'Grace',
        text: 'How did you decide which interviews to prioritise?',
        parentCommentAuthorName: 'You',
        parentCommentText: 'Interview quality matters more than interview volume.',
      },
      preferences: { tone: 'insightful', length: 'short' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty incoming reply', () => {
    const result = generateCommentsRequestSchema.safeParse({
      post: { text: 'A valid post.' },
      reply: { text: '' },
      preferences: { tone: 'casual', length: 'short' },
    });
    expect(result.success).toBe(false);
  });
});

describe('selectedPostSchema', () => {
  it('accepts a valid selected post', () => {
    const result = selectedPostSchema.safeParse({
      postId: 'urn:li:activity:1',
      authorName: 'Grace',
      postText: 'Some text',
      selectedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty post', () => {
    const result = selectedPostSchema.safeParse({
      postId: 'urn:li:activity:1',
      postText: '',
      selectedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a selected reply target without breaking selected posts', () => {
    const result = selectedPostSchema.safeParse({
      postId: 'urn:li:activity:1',
      postText: 'Some text',
      selectedAt: new Date().toISOString(),
      replyContext: {
        targetId: 'urn:li:comment:2',
        authorName: 'Grace',
        text: 'A reply directed at the user.',
        parentCommentText: "The user's earlier comment.",
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects punctuation-only text as a selected reply', () => {
    const result = selectedPostSchema.safeParse({
      postId: 'urn:li:activity:1',
      postText: 'Some text',
      selectedAt: new Date().toISOString(),
      replyContext: {
        targetId: 'urn:li:comment:2',
        authorName: 'Grace',
        text: '...',
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('generateCommentsResponseSchema', () => {
  it('accepts a valid response', () => {
    const result = generateCommentsResponseSchema.safeParse({
      requestId: 'req_1',
      postSummary: 'A post about shipping v2.',
      suggestions: [
        { id: 's1', tone: 'insightful', text: 'A thoughtful comment.' },
        { id: 's2', tone: 'casual', text: 'Another comment.' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects suggestions without ids', () => {
    const result = generateCommentsResponseSchema.safeParse({
      requestId: 'req_1',
      postSummary: 'Summary',
      suggestions: [{ tone: 'insightful', text: 'Comment' }],
    });
    expect(result.success).toBe(false);
  });
});
