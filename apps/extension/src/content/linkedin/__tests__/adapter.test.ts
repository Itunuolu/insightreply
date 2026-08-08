import { afterEach, describe, expect, it } from 'vitest';
import {
  extractAuthorName,
  extractPostData,
  extractPostId,
  extractPostText,
  findPostContainers,
  isPostTruncated,
  resolvePostContainer,
} from '../adapter.js';
import {
  FE_POST_TESTDATA,
  FEED_CONTAINER,
  FEED_POST_2026,
  FEED_POST_2026_TRUNCATED,
  FEED_POST_CLASSIC,
  POLL_POST,
  TRUNCATED_POST,
} from '../../../test/fixtures.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('findPostContainers', () => {
  it('finds classic feed posts', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const containers = findPostContainers(root);
    expect(containers).toHaveLength(1);
  });

  it('finds testid-based posts and ignores non-post divs', () => {
    const root = FEED_CONTAINER(FE_POST_TESTDATA);
    const containers = findPostContainers(root);
    expect(containers).toHaveLength(1);
  });

  it('finds multiple posts on the same page', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC + FE_POST_TESTDATA);
    expect(findPostContainers(root)).toHaveLength(2);
  });
});

describe('extractPostText', () => {
  it('extracts text from the classic markup', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    const text = extractPostText(container);
    expect(text).toContain('analytics dashboard');
    expect(text).not.toContain('Comment');
  });

  it('extracts text from testid markup', () => {
    const root = FEED_CONTAINER(FE_POST_TESTDATA);
    const container = root.querySelector('article') as HTMLElement;
    const text = extractPostText(container);
    expect(text).toContain('database started crying');
  });
});

describe('extractAuthorName', () => {
  it('extracts the display name from actor markup', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    expect(extractAuthorName(container)).toBe('Ada Lovelace');
  });

  it('extracts the display name from the meta link', () => {
    const root = FEED_CONTAINER(FE_POST_TESTDATA);
    const container = root.querySelector('article') as HTMLElement;
    expect(extractAuthorName(container)).toBe('Grace Hopper');
  });

  it('returns undefined when no author is present', () => {
    const root = FEED_CONTAINER('<div class="feed-shared-update-v2" data-urn="x"></div>');
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    expect(extractAuthorName(container)).toBeUndefined();
  });
});

describe('extractPostId', () => {
  it('reads data-urn', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    expect(extractPostId(container)).toBe('urn:li:activity:720123456789');
  });

  it('reads data-id', () => {
    const root = FEED_CONTAINER(TRUNCATED_POST);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    expect(extractPostId(container)).toBe('urn:li:activity:112233');
  });
});

describe('isPostTruncated', () => {
  it('detects a see-more button', () => {
    const root = FEED_CONTAINER(TRUNCATED_POST);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    expect(isPostTruncated(container)).toBe(true);
  });

  it('returns false for a fully expanded post', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    expect(isPostTruncated(container)).toBe(false);
  });
});

describe('extractPostData', () => {
it('returns a validated post with author, text and url', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    const result = extractPostData(container);
    expect(result.error).toBeUndefined();
    expect(result.post).toMatchObject({
      postId: 'urn:li:activity:720123456789',
      authorName: 'Ada Lovelace',
      truncated: false,
    });
    expect(result.post?.postText).toContain('analytics dashboard');
    expect(result.post?.selectedAt).toBeTruthy();
  });

  it('extracts from the 2026 post-detail layout (role=listitem)', () => {
    const root = FEED_CONTAINER(FEED_POST_2026);
    const containers = findPostContainers(root);
    expect(containers).toHaveLength(1);

    const container = containers[0]!;
    const result = extractPostData(container);
    expect(result.error).toBeUndefined();
    expect(result.post).toMatchObject({
      authorName: 'Grace Hopper',
      truncated: false,
    });
    expect(result.post?.postId).toMatch(/^urn:li:activity:insightreply-[\da-z]+$/);
    expect(result.post?.postText).toContain('weekly cadence');
    // The inert "more" toggle must not leak into the extracted text.
    expect(result.post?.postText).not.toContain('more');
    expect(result.post?.postText).not.toContain('…');
  });

  it('flags collapsed 2026 posts as truncated', () => {
    const root = FEED_CONTAINER(FEED_POST_2026_TRUNCATED);
    const container = findPostContainers(root)[0]!;
    const result = extractPostData(container);
    expect(result.post).toBeNull();
    expect(result.error).toBe('truncated');
  });

  it('flags truncated posts without extracting', () => {
    const root = FEED_CONTAINER(TRUNCATED_POST);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    const result = extractPostData(container);
    expect(result.post).toBeNull();
    expect(result.error).toBe('truncated');
  });

  it('flags poll posts as unsupported', () => {
    const root = FEED_CONTAINER(POLL_POST);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    const result = extractPostData(container);
    expect(result.post).toBeNull();
    expect(result.error).toBe('unsupported_post_type');
  });

  it('flags posts without text', () => {
    const root = FEED_CONTAINER(
      '<div class="feed-shared-update-v2" data-urn="urn:li:activity:empty"><div class="feed-shared-social-actions"></div></div>',
    );
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    const result = extractPostData(container);
    expect(result.post).toBeNull();
    expect(result.error).toBe('no_post_text');
  });
});

describe('post registry', () => {
  it('resolves the exact container for a selected post id', () => {
    const root = FEED_CONTAINER(FEED_POST_CLASSIC + FE_POST_TESTDATA);
    const [first, second] = findPostContainers(root);
    const result = extractPostData(first!);
    expect(resolvePostContainer(result.post!.postId)).toBe(first);
    expect(resolvePostContainer(result.post!.postId)).not.toBe(second);
  });

  it('returns null for an unknown post id', () => {
    expect(resolvePostContainer('urn:li:activity:does-not-exist')).toBeNull();
  });
});

