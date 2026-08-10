import type { SelectedPost } from '@insightreply/shared';
import {
  AUTHOR_NAME_SELECTORS,
  COMMENT_ACTION_SELECTORS,
  ENGAGEMENT_BAR_SELECTORS,
  MOUNTED_ATTRIBUTE,
  OWN_ELEMENT_CLASS,
  POST_CONTAINER_SELECTORS,
  POST_ID_ATTRIBUTE,
  POST_TEXT_SELECTORS,
  SEE_MORE_SELECTORS,
  matchesCommentActionText,
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

/**
 * Finds all eligible post containers currently rendered in the document.
 *
 * LinkedIn nests matching elements (a `div[role="listitem"]` row wrapping the
 * post card, and comment entities that are themselves list items), so a raw
 * match list contains several elements per post. Only the outermost match of
 * each nest is kept: that yields exactly one button per post and drops nested
 * comment entities, which are not posts.
 */
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
  const outermost = results.filter(
    (element) => !results.some((other) => other !== element && other.contains(element)),
  );
  return outermost.filter(isVisible).filter(looksLikePost);
}

/**
 * Post ids LinkedIn assigns to things that are not user posts (in-app
 * promotions, upsell cards). These carry post-like markup but must not be
 * offered as something to comment on.
 */
const NON_POST_URN_PATTERN = /^urn:li:(inAppPromotion|adUnit|promo)/i;

/**
 * A container qualifies as a post only when it exposes real post body text.
 * Rows such as "People you may know", ads and connection prompts match the
 * container selectors but have no post text, and previously received a button
 * whose extraction fell back to scraping the row's UI chrome.
 */
export function looksLikePost(container: HTMLElement): boolean {
  for (const attribute of ['data-urn', 'data-id', 'data-activity-urn']) {
    const value = container.getAttribute(attribute);
    if (value && NON_POST_URN_PATTERN.test(value)) return false;
  }
  return POST_TEXT_SELECTORS.some((selector) => Boolean(container.querySelector(selector)));
}

/**
 * Trailing connection-degree and follow badges LinkedIn renders inside the
 * actor block ("Ada Lovelace • 1st"). They are layout, not part of the name.
 */
const AUTHOR_BADGE_PATTERN = /\s*[•·|]\s*(1st|2nd|3rd\+?|following|connection)\s*$/i;

/** Collapses LinkedIn's whitespace-heavy actor markup into a single-line name. */
function cleanAuthorName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().replace(AUTHOR_BADGE_PATTERN, '').trim();
}

/** Extracts the author display name from a post container. */
export function extractAuthorName(container: HTMLElement): string | undefined {
  for (const selector of AUTHOR_NAME_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) continue;
    const text = cleanAuthorName(element.textContent ?? '');
    if (text.length > 0 && text.length <= 200) return text;
  }
  // 2026 fallback: no actor selector survives, but the post's overflow menu
  // still names the author ("Open control menu for post by Ada Lovelace").
  const menu = container.querySelector<HTMLElement>('[aria-label*="for post by" i]');
  const fromMenu = menu?.getAttribute('aria-label')?.match(/for post by\s+(.+?)\s*$/i)?.[1];
  if (fromMenu) {
    const text = cleanAuthorName(fromMenu);
    if (text.length > 0 && text.length <= 200) return text;
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
  // Strip InsightReply's own injected markup first: the fallback path reads the
  // whole container, and the button label would otherwise be sent to the AI as
  // if it were part of the post.
  for (const inert of [...SEE_MORE_SELECTORS, `.${OWN_ELEMENT_CLASS}`, '.insightreply-row']) {
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

/** Attributes carrying a real LinkedIn urn — always preferred as the post id. */
const URN_ATTRIBUTES = ['data-id', 'data-urn', 'data-activity-urn'] as const;

/**
 * The 2026 render key. It identifies the row but is not a urn, so it is only
 * used when no urn can be found anywhere near the container.
 */
const KEY_ATTRIBUTES = ['componentkey'] as const;

/** How far up the tree to look for an id before giving up. */
const ID_ANCESTOR_DEPTH = 3;

/**
 * Extracts a stable-ish post id from the container.
 *
 * The id is not always on the container itself: the 2026 feed renders a bare
 * `div[role="listitem"]` whose `componentkey` sits on the parent element, and
 * on other surfaces the activity urn is on a descendant card. Both are checked
 * before giving up.
 */
export function extractPostId(container: HTMLElement): string | undefined {
  const existing = container.getAttribute(POST_ID_ATTRIBUTE);
  if (existing) return existing;

  const readFrom = (
    element: Element | null | undefined,
    attributes: readonly string[],
  ): string | undefined => {
    if (!element) return undefined;
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (value && value.trim().length > 0) return value.trim();
    }
    return undefined;
  };

  // A real urn wins wherever it is found: on the row itself, or on the post
  // card nested inside it.
  const urnOnSelf = readFrom(container, URN_ATTRIBUTES);
  if (urnOnSelf) return urnOnSelf;

  const descendant = container.querySelector(
    '[data-urn^="urn:li:"], [data-id^="urn:li:"], [data-activity-urn]',
  );
  const urnOnDescendant = readFrom(descendant, URN_ATTRIBUTES);
  if (urnOnDescendant) return urnOnDescendant;

  // No urn: fall back to the render key, which the 2026 feed puts on the
  // element *above* the post row rather than on the row itself.
  const keyOnSelf = readFrom(container, KEY_ATTRIBUTES);
  if (keyOnSelf) return keyOnSelf;

  let ancestor = container.parentElement;
  for (let depth = 0; depth < ID_ANCESTOR_DEPTH && ancestor; depth += 1) {
    const keyOnAncestor = readFrom(ancestor, KEY_ATTRIBUTES);
    if (keyOnAncestor) return keyOnAncestor;
    ancestor = ancestor.parentElement;
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
/**
 * A LinkedIn-issued urn for this post, if one can be found. `componentkey`
 * values are accepted as a locator by `extractPostId` but are not urns and are
 * not stable enough to identify a post, so anything that is not a urn falls
 * through to the text-derived id.
 */
function nativePostId(container: HTMLElement): string | undefined {
  const id = extractPostId(container);
  return id && /^urn:li:/i.test(id) ? id : undefined;
}

export function extractPostData(container: HTMLElement): ExtractResult {
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

  // Not every surface exposes a urn (the 2026 feed exposes none on the post
  // row), so fall back to an id derived from the text. Selection must never
  // fail just because LinkedIn moved its identifiers.
  const postId = nativePostId(container) ?? generatedPostId(postText);

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

/**
 * Finds LinkedIn's "Comment" action button inside a post container.
 * InsightReply's own button is excluded — its aria-label contains the word
 * "comment", so it would otherwise match and the extension would anchor to
 * (and click) itself.
 */
export function findCommentAction(container: HTMLElement): HTMLElement | null {
  const isOwn = (element: Element) => element.classList.contains(OWN_ELEMENT_CLASS);
  for (const selector of COMMENT_ACTION_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (element && !isOwn(element) && isVisible(element)) return element;
  }
  const byText = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
    (element) => !isOwn(element) && matchesCommentActionText(element.textContent) && isVisible(element),
  );
  return byText ?? null;
}

/** Marks a container as handled to prevent duplicate button injection. */
export function isMounted(container: HTMLElement): boolean {
  return container.hasAttribute(MOUNTED_ATTRIBUTE);
}

export function markMounted(container: HTMLElement): void {
  container.setAttribute(MOUNTED_ATTRIBUTE, 'true');
}
