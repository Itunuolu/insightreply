import { describe, expect, it, vi } from 'vitest';
import {
  clearSelectedPost,
  loadSelectedPost,
  loadSettings,
  saveSettings,
  watchSelectedPost,
} from '../lib/storage.js';
import { DEFAULT_SETTINGS } from '@insightreply/shared';

describe('settings persistence', () => {
  it('loads defaults when nothing is stored', async () => {
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and reloads settings', async () => {
    const next = { ...DEFAULT_SETTINGS, defaultTone: 'casual' as const, suggestionCount: 4 };
    await saveSettings(next);
    const loaded = await loadSettings();
    expect(loaded.defaultTone).toBe('casual');
    expect(loaded.suggestionCount).toBe(4);
  });

  it('falls back to defaults for corrupt stored settings', async () => {
    await chrome.storage.sync.set({ insightReplySettings: { defaultTone: 'not-a-tone' } });
    const settings = await loadSettings();
    expect(settings.defaultTone).toBe(DEFAULT_SETTINGS.defaultTone);
  });

  it('rejects invalid settings at save time', async () => {
    await expect(
      saveSettings({ ...DEFAULT_SETTINGS, backendUrl: 'not-a-url' }),
    ).rejects.toThrow();
  });
});

describe('selected post state (session storage)', () => {
  const post = {
    postId: 'urn:li:activity:1',
    authorName: 'Grace',
    postText: 'Text of the post',
    selectedAt: new Date().toISOString(),
  };

  it('stores and loads a selected post', async () => {
    await chrome.storage.session.set({ 'insightReply.selectedPost': post });
    const loaded = await loadSelectedPost();
    expect(loaded).toMatchObject({
      postId: 'urn:li:activity:1',
      authorName: 'Grace',
    });
  });

  it('returns null when nothing is selected', async () => {
    expect(await loadSelectedPost()).toBeNull();
  });

  it('clears the selected post', async () => {
    await chrome.storage.session.set({ 'insightReply.selectedPost': post });
    await clearSelectedPost();
    expect(await loadSelectedPost()).toBeNull();
  });
});

describe('watchSelectedPost', () => {
  it('notifies when a new post is selected', async () => {
    const onPost = vi.fn();
    const unsubscribe = watchSelectedPost(onPost);

    await chrome.storage.session.set({
      'insightReply.selectedPost': {
        postId: 'x',
        postText: 'new post',
        selectedAt: 'now',
      },
    });

    // The mock emits synchronously but the listener is async-safe.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ postId: 'x' }));
    unsubscribe();
  });

  it('reports null when the selected post is cleared', async () => {
    await chrome.storage.session.set({
      'insightReply.selectedPost': {
        postId: 'x',
        postText: 'new post',
        selectedAt: 'now',
      },
    });
    const onPost = vi.fn();
    watchSelectedPost(onPost);
    await chrome.storage.session.remove('insightReply.selectedPost');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onPost).toHaveBeenCalledWith(null);
  });
});