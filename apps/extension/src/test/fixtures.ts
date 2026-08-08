/** Static HTML fixtures modelling several likely LinkedIn post structures for unit tests. */

export const FEED_POST_CLASSIC = `
<div class="feed-shared-update-v2" data-urn="urn:li:activity:720123456789">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Ada Lovelace</span>
  </div>
  <div class="feed-shared-inline-show-more-text">
    <span dir="auto" class="update-components-text">We just shipped a new analytics dashboard after a year of customer interviews. It taught us that listening beats guessing.</span>
  </div>
  <div class="feed-shared-social-actions">
    <button aria-label="Comment">Comment</button>
  </div>
</div>
`;

export const FE_POST_TESTDATA = `
<article class="feed-shared-update-v2" data-urn="urn:li:activity:9876543210">
  <a href="https://www.linkedin.com/in/grace-hopper" class="update-components-actor__meta-link">
    <span dir="auto">Grace Hopper</span>
  </a>
  <div data-testid="main-feed-activity-card__commentary">
    <span dir="auto">We scaled to 10,000 users and our database started crying. Here is the boring fix that worked.</span>
  </div>
  <div data-testid="main-feed-activity-card__social-actions">
    <button data-control-name="comment" aria-label="Comment">Comment</button>
  </div>
</article>
`;

export const TRUNCATED_POST = `
<div class="feed-shared-update-v2" data-id="urn:li:activity:112233">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Alan Turing</span>
  </div>
  <div class="feed-shared-inline-show-more-text">
    <span dir="auto">This is the visible start of a much longer post that LinkedIn hides behind a see more control.</span>
    <button class="feed-shared-inline-show-more-text__button" aria-label="see more">…see more</button>
  </div>
  <div class="feed-shared-social-actions">
    <button aria-label="Comment">Comment</button>
  </div>
</div>
`;

export const POLL_POST = `
<div class="feed-shared-update-v2" data-urn="urn:li:activity:poll_1">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Katherine Johnson</span>
  </div>
  <div class="feed-shared-inline-show-more-text">
    <span dir="auto">Which approach do you prefer?</span>
  </div>
  <div class="feed-shared-poll">
    <button>Option A</button><button>Option B</button>
  </div>
  <div class="feed-shared-social-actions">
    <button aria-label="Comment">Comment</button>
  </div>
</div>
`;

export const POST_WITH_OPEN_EDITOR = `
<div class="feed-shared-update-v2" data-urn="urn:li:activity:editor_1">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Edsger Dijkstra</span>
  </div>
  <div class="feed-shared-inline-show-more-text">
    <span dir="auto">Simplicity is a prerequisite for reliability.</span>
  </div>
  <div class="feed-shared-social-actions">
    <button aria-label="Comment">Comment</button>
  </div>
  <div class="comments-comment-box">
    <form class="comments-comment-box__form">
      <div class="ql-editor" contenteditable="true" data-placeholder="Add a comment…"></div>
    </form>
  </div>
</div>
`;

export const POST_WITH_PREFILLED_EDITOR = `
<div class="feed-shared-update-v2" data-urn="urn:li:activity:editor_2">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Edsger Dijkstra</span>
  </div>
  <div class="feed-shared-inline-show-more-text">
    <span dir="auto">Testing shows the presence, not the absence, of bugs.</span>
  </div>
  <div class="comments-comment-box__form">
    <div class="ql-editor" contenteditable="true" role="textbox" aria-label="Comment box">Existing draft text here</div>
  </div>
</div>
`;

/**
 * Models the 2026 comment box: TipTap/ProseMirror, no `comments-comment-box__form`
 * wrapper and no `.ql-editor`, with the Comment action carrying no aria-label.
 */
export const POST_WITH_TIPTAP_EDITOR = `
<div class="feed-shared-update-v2" data-urn="urn:li:activity:tiptap_1">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Barbara Liskov</span>
  </div>
  <div class="feed-shared-inline-show-more-text">
    <span dir="auto" class="update-components-text">Subtypes must be substitutable for their base types.</span>
  </div>
  <div class="_6ebd00b4">
    <button type="button"><span>Like</span></button>
    <button type="button"><span>Comment</span></button>
    <button type="button"><span>Repost</span></button>
  </div>
  <div data-testid="ui-core-tiptap-text-editor-wrapper">
    <div class="tiptap ProseMirror" contenteditable="true" role="textbox" dir="auto"
         aria-label="Text editor for creating comment"></div>
  </div>
</div>
`;

/**
 * A feed row where the post card is nested inside a `role="listitem"` wrapper and
 * carries its own comment thread — both previously matched the container
 * selectors, producing three buttons for one post.
 */
export const NESTED_FEED_ROW = `
<div role="listitem" componentkey="rowKey1">
  <div class="feed-shared-update-v2" data-urn="urn:li:activity:nested_1">
    <div class="update-components-actor">
      <span class="update-components-actor__name">Ada Lovelace
        <span> • 1st</span>
      </span>
    </div>
    <div class="update-components-text"><span dir="auto">The nested post body.</span></div>
    <div class="feed-shared-social-actions"><button aria-label="Comment">Comment</button></div>
    <div class="comments-comments-list">
      <div role="listitem" class="comments-comment-entity">
        <div class="update-components-text"><span dir="auto">A reply from someone else.</span></div>
      </div>
    </div>
  </div>
</div>
`;

/** A feed row that is not a post: no post body, only a connection prompt. */
export const NON_POST_ROW = `
<div role="listitem" componentkey="pymkKey1">
  <a href="/in/someone"><span dir="auto">Suggested Person</span></a>
  <button aria-label="Invite Suggested Person to connect">Connect</button>
</div>
`;

/** A row LinkedIn marks as an in-app promotion rather than a member post. */
export const PROMOTION_ROW = `
<div role="listitem" data-urn="urn:li:inAppPromotion:16343">
  <div class="update-components-text"><span dir="auto">Try Premium free for one month.</span></div>
</div>
`;

/** Models the 2026 LinkedIn post-detail rewrite (hashed classes + componentkey). */
export const FEED_POST_2026 = `
<div role="listitem" componentkey="expandedhqTYjkLbsH-b4J1o1cIgUQ86KKBnQ3g20QjevyOX10EFeedType_94fvyOOla">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Grace Hopper</span>
  </div>
  <span data-testid="expandable-text-box">
    We moved to a weekly cadence. The lesson: retained users complete the core workflow within the first week.
    <button type="button" aria-hidden="true" data-testid="expandable-text-button">
      <span><span>…</span><span> more</span></span>
    </button>
  </span>
  <div class="feed-shared-social-actions-nx">
    <button aria-label="Comment">Comment</button>
    <button aria-label="Like">Like</button>
    <button aria-label="Repost">Repost</button>
  </div>
</div>
`;

/** Collapsed 2026 post: the "more" button is a real, interactive control. */
export const FEED_POST_2026_TRUNCATED = `
<div role="listitem" componentkey="expandedFeedPostB58hTro3mMWXeY0Qsjevy46FxT">
  <div class="hashed-author">
    <span dir="auto">Alan Turing</span>
  </div>
  <span data-testid="expandable-text-box">
    This is the visible start of a much longer post that LinkedIn hides behind the more control.
    <button type="button" data-testid="expandable-text-button" aria-label="…more">
      <span><span>…</span><span> more</span></span>
    </button>
  </span>
</div>
`;

export const FEED_CONTAINER = (innerHtml: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = innerHtml;
  document.body.appendChild(wrapper);
  return wrapper;
};
