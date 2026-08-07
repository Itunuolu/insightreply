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

/** Modules the 2026 LinkedIn post-detail rewrite (CSS-in-JS hashed classes + data-view-name). */
export const FEED_POST_2026 = `
<div data-view-name="feed-full-update" data-urn="urn:li:activity:2026010101">
  <div data-view-name="feed-actor-title">Grace Hopper</div>
  <div data-testid="expandable-text-box">
    We moved to a weekly cadence and realised retained users finish the core workflow within the first week.
  </div>
  <div data-view-name="feed-social-actions">
    <button data-view-name="feed-action-item" aria-label="Comment">Comment</button>
  </div>
</div>
`;

export const FEED_CONTAINER = (innerHtml: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = innerHtml;
  document.body.appendChild(wrapper);
  return wrapper;
};
