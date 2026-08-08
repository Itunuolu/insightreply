import { describe, expect, it, vi } from 'vitest';
import { generateComments, regenerateSingleSuggestion } from '../lib/api.js';
import { DEFAULT_SETTINGS, type SelectedPost } from '@insightreply/shared';

const post: SelectedPost = {
  postId: 'urn:li:activity:1',
  authorName: 'Ada',
  postText: 'We shipped v2 of our analytics product.',
  truncated: false,
  selectedAt: '2026-01-01T00:00:00.000Z',
};

const compose = { tone: 'insightful' as const, length: 'medium' as const, perspective: '' };

function okResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      requestId: 'req_1',
      postSummary: 'A post about analytics.',
      suggestions: [
        { id: 's1', tone: 'insightful', text: 'The interview loop is the real story here.' },
        { id: 's2', tone: 'insightful', text: 'What metric proved the dashboard worked for users?' },
        { id: 's3', tone: 'insightful', text: 'A year of research before building is rare discipline.' },
      ],
    }),
  };
}

describe('generateComments', () => {
  it('posts a valid payload and parses the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateComments({ settings: DEFAULT_SETTINGS, post, compose });

    expect(result.suggestions).toHaveLength(3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8787/v1/comments/generate');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body.preferences.tone).toBe('insightful');
    expect(body.preferences.emojiPreference).toBe('none');
    expect(body.post.authorName).toBe('Ada');
  });

  it('rejects the request locally when the post exceeds the limit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      generateComments({
        settings: DEFAULT_SETTINGS,
        post: { ...post, postText: 'x'.repeat(12_001) },
        compose,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps backend errors to a user-facing message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }),
      }),
    );
    await expect(
      generateComments({ settings: DEFAULT_SETTINGS, post, compose }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      generateComments({ settings: DEFAULT_SETTINGS, post, compose }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('rejects malformed successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ nope: true }) }),
    );
    await expect(
      generateComments({ settings: DEFAULT_SETTINGS, post, compose }),
    ).rejects.toMatchObject({ code: 'INVALID_AI_OUTPUT' });
  });
});

describe('regenerateSingleSuggestion', () => {
  it('prefers a suggestion that differs from the current drafts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    const fresh = await regenerateSingleSuggestion({
      settings: { ...DEFAULT_SETTINGS, suggestionCount: 2 },
      post,
      compose,
      currentTexts: [okResponseJson().suggestions[0]!.text],
    });
    expect(fresh).toBeTruthy();
  });

  it('falls back to the first suggestion when all are similar', async () => {
    const similar = 'The interview loop is the real story here.';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          requestId: 'req_2',
          postSummary: 'summary',
          suggestions: [
            { id: 'a', tone: 'insightful', text: similar },
            { id: 'b', tone: 'insightful', text: similar },
          ],
        }),
      }),
    );
    const fresh = await regenerateSingleSuggestion({
      settings: DEFAULT_SETTINGS,
      post,
      compose,
      currentTexts: [similar],
    });
    expect(fresh?.text).toBe(similar);
  });
});

function okResponseJson() {
  return {
    requestId: 'req_1',
    postSummary: 'A post about analytics.',
    suggestions: [
      { id: 's1', tone: 'insightful', text: 'The interview loop is the real story here.' },
      { id: 's2', tone: 'insightful', text: 'What metric proved the dashboard worked for users?' },
      { id: 's3', tone: 'insightful', text: 'A year of research before building is rare discipline.' },
    ],
  };
}
describe('backend URL normalization', () => {
  it('strips a trailing slash so the request path has no double slash', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await generateComments({
      settings: { ...DEFAULT_SETTINGS, backendUrl: 'http://localhost:8787/' },
      post,
      compose,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8787/v1/comments/generate');
  });

  it('leaves a URL without a trailing slash untouched', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await generateComments({
      settings: { ...DEFAULT_SETTINGS, backendUrl: 'https://api.example.com' },
      post,
      compose,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/comments/generate');
  });
});
