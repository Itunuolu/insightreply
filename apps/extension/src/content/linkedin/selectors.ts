/**
 * All LinkedIn DOM selectors live in this file, isolated so that a LinkedIn
 * DOM change can be fixed in one place. Each selector list is ordered by
 * (roughly) recency/reliability with multiple fallbacks.
 *
 * Maintenance guide: docs/linkedin-selector-maintenance.md
 */

/** Candidate containers for a single feed post or post page. */
export const POST_CONTAINER_SELECTORS: string[] = [
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

/** Controls that open the comment editor ("Comment" action). */
export const COMMENT_ACTION_SELECTORS: string[] = [
  '[data-view-name="feed-action-item"][aria-label*="Comment" i]',
  'button[aria-label*="Comment" i]',
  'button[aria-label*="comment" i]',
  '[data-control-name="comment"]',
  '[data-testid="comments-button"]',
  'button.comments-comment-box__open-comment-box',
];

/** The comment editor itself (contenteditable), once opened. */
export const COMMENT_EDITOR_SELECTORS: string[] = [
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
  '[data-testid="feed-shared-inline-show-more-text__button"]',
  '.feed-shared-inline-show-more-text__button',
  'button.feed-shared-inline-show-more-text__more-link',
];

/** Anchor used to mark a post container as already handled by InsightReply. */
export const MOUNTED_ATTRIBUTE = 'data-insightreply-mounted';

/** Per-page registry attribute that maps a post container to its post id. */
export const POST_ID_ATTRIBUTE = 'data-insightreply-id';
