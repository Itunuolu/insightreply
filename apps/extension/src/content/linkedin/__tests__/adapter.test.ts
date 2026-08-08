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
  NESTED_FEED_ROW,
  NON_POST_ROW,
  POLL_POST,
  PROMOTION_ROW,
  TRUNCATED_POST,
} from '../../../test/fixtures.js';

describe('container selection', () => {
  it('returns one container per post when the post card is nested in a listitem row', () => {
    FEED_CONTAINER(NESTED_FEED_ROW);
    const containers = findPostContainers();
    expect(containers).toHaveLength(1);
    expect(containers[0]?.getAttribute('role')).toBe('listitem');
  });

  it('ignores comment entities nested inside a post', () => {
    FEED_CONTAINER(NESTED_FEED_ROW);
    const containers = findPostContainers();
    expect(containers.some((c) => c.classList.contains('comments-comment-entity'))).toBe(false);
  });

  it('ignores rows with no post body, such as connection prompts', () => {
    FEED_CONTAINER(NON_POST_ROW);
    expect(findPostContainers()).toHaveLength(0);
  });

  it('ignores in-app promotions even though they carry post-like markup', () => {
    FEED_CONTAINER(PROMOTION_ROW);
    expect(findPostContainers()).toHaveLength(0);
  });
});

describe('2026 feed id resolution', () => {
  it('finds a componentkey that lives on the parent of the post row', () => {
    const root = FEED_CONTAINER(
      '<div componentkey="expandedParentKey1"><div role="listitem">' +
        '<span data-testid="expandable-text-box">A post whose id lives on the parent.</span>' +
        '</div></div>',
    );
    const container = root.querySelector('div[role="listitem"]') as HTMLElement;
    expect(extractPostId(container)).toBe('expandedParentKey1');
  });

  it('selects the post instead of failing when no id is on the container', () => {
    const root = FEED_CONTAINER(
      '<div componentkey="expandedParentKey2"><div role="listitem">' +
        '<span data-testid="expandable-text-box">A post whose id lives on the parent.</span>' +
        '</div></div>',
    );
    const container = root.querySelector('div[role="listitem"]') as HTMLElement;
    const result = extractPostData(container);
    expect(result.error).toBeUndefined();
    expect(result.post?.postId).toMatch(/^urn:li:activity:/);
    expect(result.post?.postText).toContain('id lives on the parent');
  });

  it('prefers a urn found on a descendant card over a generated id', () => {
    FEED_CONTAINER(NESTED_FEED_ROW);
    const container = findPostContainers()[0]!;
    expect(extractPostData(container).post?.postId).toBe('urn:li:activity:nested_1');
  });
});

describe('extraction hygiene', () => {
  it('strips the connection-degree badge and collapses whitespace in author names', () => {
    FEED_CONTAINER(NESTED_FEED_ROW);
    const container = findPostContainers()[0]!;
    expect(extractAuthorName(container)).toBe('Ada Lovelace');
  });

  it('never includes its own injected button text in the extracted post text', () => {
    const root = FEED_CONTAINER(NESTED_FEED_ROW);
    const container = root.querySelector('div[role="listitem"]') as HTMLElement;
    const own = document.createElement('button');
    own.className = 'insightreply-button';
    own.textContent = '✨ AI Comment';
    container.appendChild(own);
    expect(extractPostText(container)).not.toContain('AI Comment');
  });
});

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

