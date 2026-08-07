import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractPostData } from '../linkedin/adapter.js';
import { injectActionButton } from '../linkedin/button.js';
import {
  FE_POST_TESTDATA,
  FEED_CONTAINER,
  FEED_POST_CLASSIC,
  TRUNCATED_POST,
} from '../../test/fixtures.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('injectActionButton', () => {
  it('injects exactly one AI Comment button per post', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;

    injectActionButton(container);
    injectActionButton(container);
    injectActionButton(container);

    const buttons = container.querySelectorAll('button.insightreply-button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain('AI Comment');
  });

  it('marks the container as mounted', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    injectActionButton(container);
    expect(container.hasAttribute('data-insightreply-mounted')).toBe(true);
  });

  it('injects a button per post when multiple posts exist', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC + FE_POST_TESTDATA);
    for (const container of root.querySelectorAll<HTMLElement>('.feed-shared-update-v2')) {
      injectActionButton(container);
    }
    expect(root.querySelectorAll('button.insightreply-button')).toHaveLength(2);
  });
});

describe('button click flow', () => {
  it('extracts the clicked post and sends it to the service worker', async () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    injectActionButton(container);

    const button = container.querySelector('button.insightreply-button') as HTMLButtonElement;
    const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValue({ ok: true });

    button.click();
    // Allow the async handler to complete.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [message] = sendMessage.mock.calls[0] as [
      { type: string; post: { postId: string; authorName?: string; postText: string } },
    ];
    expect(message.type).toBe('IR_SELECT_POST');
    expect(message.post.postId).toBe('urn:li:activity:720123456789');
    expect(message.post.authorName).toBe('Ada Lovelace');
    expect(message.post.postText).toContain('analytics dashboard');
  });

  it('shows a truncation toast without sending the post', async () => {
    const root = FEED_CONTAINER(TRUNCATED_POST);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    injectActionButton(container);

    const button = container.querySelector('button.insightreply-button') as HTMLButtonElement;
    const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValue({ ok: true });

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const toast = document.querySelector('.insightreply-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Expand the post first');

    const sent = sendMessage.mock.calls.flat();
    expect(sent.some((m: { type?: string }) => m && typeof m === 'object' && m.type === 'IR_SELECT_POST')).toBe(false);
  });

  it('sends the raw selection through the full content-script pipeline', async () => {
    // extractPostData -> message -> (mock) service worker
    const root = FEED_CONTAINER(FE_POST_TESTDATA);
    const container = root.querySelector('article') as HTMLElement;
    const result = extractPostData(container);
    expect(result.post?.authorName).toBe('Grace Hopper');
    expect(result.post?.postText).toContain('10,000 users');
  });
});
