import type { SelectedPost } from '@insightreply/shared';
import {
  AUTHOR_NAME_SELECTORS,
  COMMENT_ACTION_SELECTORS,
  ENGAGEMENT_BAR_SELECTORS,
  MOUNTED_ATTRIBUTE,
  POST_CONTAINER_SELECTORS,
  POST_ID_ATTRIBUTE,
  POST_TEXT_SELECTORS,
  SEE_MORE_SELECTORS,
} from './selectors.js';

export type ExtractErrorCode =
  | 'no_container'
  | 'no_post_text'
  | 'unsupported_post_type'
  | 'truncated';

export interface ExtractResult {
  post: SelectedPost | null;
  error?: ExtractErrorCode;
}

const isVisible = (el: Element): boolean => {
  if (!el.isConnected) return false;
  if (el instanceof HTMLElement) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
};

/** Finds the closest post container for an element (e.g. the clicked button). */
export function findPostContainerFor(el: Element): HTMLElement | null {
  const direct = el.closest<HTMLElement>(POST_CONTAINER_SELECTORS.join(','));
  if (direct) return direct;
  return findPostContainers().find(
    (container) => container.contains(el) || isNearby(container, el),
  ) ?? null;
}

function isNearby(container: HTMLElement, el: Element): boolean {
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const verticalGap = Math.max(
    0,
    elRect.top - containerRect.bottom,
    containerRect.top - elRect.bottom,
  );
  return verticalGap <= 4;
}

/** Finds all eligible post containers currently rendered in the document. */
export function findPostContainers(root: ParentNode = document): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const results: HTMLElement[] = [];
  for (const selector of POST_CONTAINER_SELECTORS) {
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
      if (!seen.has(element)) {
        seen.add(element);
        results.push(element);
      }
    }
  }
  return results.filter(isVisible);
}

/** Extracts the author display name from a post container. */
export function extractAuthorName(container: HTMLElement): string | undefined {
  for (const selector of AUTHOR_NAME_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) continue;
    const text = element.textContent?.trim();
    if (text && text.length > 0 && text.length <= 200) return text;
  }
  return undefined;
}

/** Extracts the full post text (first non-empty candidate). */
export function extractPostText(container: HTMLElement): string {
  for (const selector of POST_TEXT_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) continue;
    const text = cleanPostText(element);
    if (text && text.length > 0) return text;
  }
  // Fallback: grab the container's own text but drop the action-bar noise.
  const text = cleanPostText(container);
  return text;
}

/**
 * Reads an element's text while stripping descendants that belong to the UI
 * chrome (e.g. the "… more" toggle that lives inside the text box in the 2026
 * DOM) rather than the post body itself.
 */
function cleanPostText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  for (const inert of SEE_MORE_SELECTORS) {
    for (const el of clone.querySelectorAll<HTMLElement>(inert)) {
      el.remove();
    }
  }
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/**
 * Detects whether the post is truncated behind a "See more" control.
 * The wrapper class is present on both expanded and collapsed posts, so the
 * only reliable signal is a *visible* see-more button. In the 2026 DOM the
 * button stays in the tree but is marked aria-hidden when the post is already
 * expanded — those are skipped.
 */
export function isPostTruncated(container: HTMLElement): boolean {
  for (const selector of SEE_MORE_SELECTORS) {
    const button = container.querySelector<HTMLElement>(selector);
    if (button && isVisible(button) && button.getAttribute('aria-hidden') !== 'true') {
      return true;
    }
  }
  return false;
}

/** Post id candidates found directly on the container element. */
const POST_ID_CANDIDATES = [
  'data-id',
  'data-urn',
  'data-activity-urn',
  'componentkey',
] as const;

/** Extracts a stable-ish post id from the container (with generated fallback). */
export function extractPostId(container: HTMLElement): string | undefined {
  const existing = container.getAttribute(POST_ID_ATTRIBUTE);
  if (existing) return existing;

  for (const attribute of POST_ID_CANDIDATES) {
    const value = container.getAttribute(attribute);
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/** Deterministic id derived from the post text (2026 DOM has no native id). */
export function generatedPostId(postText: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(postText.length, 2000); i += 1) {
    hash = (hash * 31 + postText.charCodeAt(i)) >>> 0;
  }
  return `urn:li:activity:insightreply-${hash.toString(36)}`;
}

/**
 * Registry mapping post ids -> container elements for the current page so
 * insertions can resolve back to the exact post the user selected.
 */
const postRegistry = new Map<string, HTMLElement>();

export function registerPost(postId: string, container: HTMLElement): void {
  container.setAttribute(POST_ID_ATTRIBUTE, postId);
  postRegistry.set(postId, container);
}

export function resolvePostContainer(postId: string): HTMLElement | null {
  const registered = postRegistry.get(postId);
  if (registered && registered.isConnected) return registered;
  // Fall back to a fresh scan: containers may have been re-rendered by LinkedIn
  // or registered on an earlier selection. Match either our own id attribute
  // or the native data-urn / data-id LinkedIn uses.
  const fresh =
    findPostContainers().find(
      (c) =>
        c.getAttribute(POST_ID_ATTRIBUTE) === postId ||
        c.getAttribute('data-urn') === postId ||
        c.getAttribute('data-id') === postId,
    ) ?? null;
  if (fresh) {
    postRegistry.set(postId, fresh);
    return fresh;
  }
  return null;
}

/** Identifies unsupported post types (e.g. polls or article cards without text). */
export function isUnsupportedPost(container: HTMLElement): boolean {
  return Boolean(container.querySelector('.feed-shared-poll, [data-testid="poll-card"]'));
}

/**
 * Extracts a selected post from its container. Called only when the user
 * clicks the AI Comment button for that post — never in the background.
 */
/** True when the container carries a native LinkedIn post id. */
function containsNativeId(container: HTMLElement): boolean {
  return ['data-id', 'data-urn', 'data-activity-urn'].some((attribute) =>
    Boolean(container.getAttribute(attribute)),
  );
}

export function extractPostData(container: HTMLElement): ExtractResult {
  let postId = extractPostId(container);
  if (!postId) {
    return { post: null, error: 'no_container' };
  }
  if (isUnsupportedPost(container)) {
    return { post: null, error: 'unsupported_post_type' };
  }

  const postText = extractPostText(container);
  if (!postText) {
    return { post: null, error: 'no_post_text' };
  }
  if (postText.length > 12_000) {
    return { post: null, error: 'no_post_text' };
  }

  const authorName = extractAuthorName(container);
  const truncated = isPostTruncated(container);
  if (truncated) {
    return { post: null, error: 'truncated' };
  }

  // The 2026 DOM carries no native post id; derive a stable one from the text
  // so the selection survives the round trip to the side panel.
  if (!containsNativeId(container)) {
    postId = generatedPostId(postText);
  }

  registerPost(postId, container);

  const post: SelectedPost = {
    postId,
    authorName,
    postText,
    postUrl: typeof location !== 'undefined' ? location.href : undefined,
    truncated: false,
    selectedAt: new Date().toISOString(),
  };
  return { post };
}

/** Finds the engagement bar of a post container (button anchor point). */
export function findEngagementBar(container: HTMLElement): HTMLElement | null {
  for (const selector of ENGAGEMENT_BAR_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (element && isVisible(element)) return element;
  }
  return null;
}

/** Finds the "Comment" action button inside a post container. */
export function findCommentAction(container: HTMLElement): HTMLElement | null {
  for (const selector of COMMENT_ACTION_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (element && isVisible(element)) return element;
  }
  return null;
}

/** Marks a container as handled to prevent duplicate button injection. */
export function isMounted(container: HTMLElement): boolean {
  return container.hasAttribute(MOUNTED_ATTRIBUTE);
}

export function markMounted(container: HTMLElement): void {
  container.setAttribute(MOUNTED_ATTRIBUTE, 'true');
}
