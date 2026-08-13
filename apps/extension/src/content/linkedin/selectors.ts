/**
 * All LinkedIn DOM selectors live in this file, isolated so that a LinkedIn
 * DOM change can be fixed in one place. Each selector list is ordered by
 * (roughly) recency/reliability with multiple fallbacks.
 *
 * Maintenance guide: docs/linkedin-selector-maintenance.md
 */

/** Candidate containers for a single feed post or post page. */
export const POST_CONTAINER_SELECTORS: string[] = [
  'div[role="listitem"]',
  '[data-view-name="feed-full-update"]',
  'div.feed-shared-update-v2',
  'article.feed-shared-update-v2',
  'div[data-urn^="urn:li:activity"]',
  'div[data-id^="urn:li:activity"]',
  'div[data-activity-urn^="urn:li:activity"]',
  'div[data-urn^="urn:li:aggregatedShare"]',
  'div[data-id^="urn:li:aggregatedShare"]',
];

/** Elements that hold the post body text. */
export const POST_TEXT_SELECTORS: string[] = [
  '[data-testid="expandable-text-box"]',
  '[data-testid="main-feed-activity-card__commentary"]',
  '.feed-shared-inline-show-more-text',
  '.update-components-text',
  '.feed-shared-update-v2__commentary',
  '.feed-shared-text',
  '[data-testid="feed-shared-inline-show-more-text"]',
];

/** Elements that hold the author display name. */
export const AUTHOR_NAME_SELECTORS: string[] = [
  '[data-view-name="feed-actor-title"]',
  'span.update-components-actor__name',
  'a.update-components-actor__name',
  '[data-testid="main-feed-activity-card__actor-name"]',
  '.update-components-actor__meta-link span',
  'a[href*="/in/"] span[dir="auto"]',
  'span[dir="auto"] strong',
];

/**
 * Class marking every element InsightReply injects. Every selector that scans
 * LinkedIn's own controls must exclude it: the action button's aria-label
 * contains the word "comment", so without this guard the extension matches —
 * and clicks — itself instead of LinkedIn's Comment control.
 */
export const OWN_ELEMENT_CLASS = 'insightreply-button';

const notOwn = `:not(.${OWN_ELEMENT_CLASS})`;

/** Controls that open the comment editor ("Comment" action). */
export const COMMENT_ACTION_SELECTORS: string[] = [
  `[data-view-name="feed-action-item"][aria-label*="Comment" i]${notOwn}`,
  `button[aria-label="Comment" i]${notOwn}`,
  `button[aria-label*="Comment on" i]${notOwn}`,
  `[data-control-name="comment"]${notOwn}`,
  `[data-testid="comments-button"]${notOwn}`,
  `button.comments-comment-box__open-comment-box${notOwn}`,
];

/**
 * The 2026 feed renders the Comment control with no aria-label at all — only
 * the visible word "Comment", usually beside an icon and sometimes a count.
 * Non-letters are stripped before matching so "💬 Comment" and "Comment 58"
 * are still recognised, while "View more options for X's comment." is not.
 */
export function matchesCommentActionText(raw: string | null | undefined): boolean {
  return /^comment$/i.test((raw ?? '').replace(/[^\p{L}]+/gu, ''));
}

/** The comment editor itself (contenteditable), once opened. */
export const COMMENT_EDITOR_SELECTORS: string[] = [
  // 2026: LinkedIn's comment box is TipTap/ProseMirror, not Quill.
  '[data-testid="ui-core-tiptap-text-editor-wrapper"] div[contenteditable="true"]',
  'div.tiptap[contenteditable="true"][role="textbox"][aria-label*="comment" i]',
  'div[contenteditable="true"][role="textbox"][aria-label*="comment" i]',
  // Legacy Quill-based editor, still served on some surfaces.
  '.comments-comment-box__form .ql-editor',
  '.comment-editor__textarea',
  '.comments-comment-box__form div[contenteditable="true"][role="textbox"][aria-label*="comment" i]',
  '.comments-comment-box__form div[contenteditable="true"][data-placeholder*="comment" i]',
  '[data-testid="comment-editor"] .ql-editor',
  'form.comments-comment-box__form .ql-editor',
];

/** The engagement bar under a post (where the button is anchored). */
export const ENGAGEMENT_BAR_SELECTORS: string[] = [
  '[data-view-name="feed-social-actions"]',
  '[data-testid="main-feed-activity-card__social-actions"]',
  '.feed-shared-social-actions',
  '.feed-shared-social-action-bar',
  '.social-actions-bar',
];

/** "See more" expand control inside a post. */
export const SEE_MORE_SELECTORS: string[] = [
  '[data-testid="expandable-text-button"]',
  '[data-testid="feed-shared-inline-show-more-text__button"]',
  '.feed-shared-inline-show-more-text__button',
  'button.feed-shared-inline-show-more-text__more-link',
];

/** Anchor used to mark a post container as already handled by InsightReply. */
export const MOUNTED_ATTRIBUTE = 'data-insightreply-mounted';

/** Per-page registry attribute that maps a post container to its post id. */
export const POST_ID_ATTRIBUTE = 'data-insightreply-id';

/** Candidate containers for one LinkedIn comment or reply. */
export const COMMENT_CONTAINER_SELECTORS: string[] = [
  '[data-insightreply-comment-scope]',
  '.comments-comment-entity',
  '[data-testid="comment-entity"]',
  '[data-view-name="comment"]',
  'article[data-urn^="urn:li:comment"]',
  'div[data-id^="urn:li:comment"]',
];

/** Text nodes that belong to a comment entity rather than the post body. */
export const COMMENT_TEXT_SELECTORS: string[] = [
  '.comments-comment-item__main-content',
  '.comments-comment-item-content-body',
  '[data-testid="comment-text"]',
  '[data-view-name="comment-text"]',
  'div[dir="ltr"]',
  '.update-components-text',
];

/** Comment-author display names. */
export const COMMENT_AUTHOR_SELECTORS: string[] = [
  '.comments-post-meta__name-text',
  '.comments-comment-meta__description-title',
  '[data-testid="comment-author-name"]',
  '[data-view-name="comment-author"]',
  'a[href*="/in/"] span[dir="auto"]',
];

/** LinkedIn controls that open a reply editor for a specific comment. */
export const REPLY_ACTION_SELECTORS: string[] = [
  '.comments-comment-social-bar__reply-action-button',
  'button[aria-label="Reply" i]',
  'button[aria-label^="Reply to" i]',
  'button[aria-label*="reply" i]',
  '[role="button"][aria-label*="reply" i]',
  '[data-control-name="reply_comment"]',
  '[data-testid="reply-button"]',
  '[data-view-name="comment-reply-action"]',
  '[data-view-name*="comment-reply" i]',
  'button:has(svg[data-test-icon^="comment" i])',
  '[role="button"]:has(svg[data-test-icon^="comment" i])',
];

/** Reply editors. These are searched inside the selected comment/thread scope. */
export const REPLY_EDITOR_SELECTORS: string[] = [
  '[data-testid="ui-core-tiptap-text-editor-wrapper"] div[contenteditable="true"][role="textbox"]',
  'div.tiptap[contenteditable="true"][role="textbox"][aria-label*="reply" i]',
  'div[contenteditable="true"][role="textbox"][aria-label*="reply" i]',
  '.comments-comment-box__form .ql-editor',
  'form [contenteditable="true"][data-placeholder*="reply" i]',
  'div[contenteditable="true"][role="textbox"]',
];

export const REPLY_MOUNTED_ATTRIBUTE = 'data-insightreply-reply-mounted';
export const REPLY_TARGET_ATTRIBUTE = 'data-insightreply-reply-target';
export const DYNAMIC_COMMENT_ATTRIBUTE = 'data-insightreply-comment-scope';

export function matchesReplyActionText(raw: string | null | undefined): boolean {
  return /^reply$/i.test((raw ?? '').replace(/[^\p{L}]+/gu, ''));
}
