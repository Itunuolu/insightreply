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

/** A post with the user's comment, an incoming nested reply, and a reply editor. */
export const POST_WITH_REPLY_THREAD = `
<div class="feed-shared-update-v2" data-urn="urn:li:activity:reply_post_1">
  <div class="update-components-actor">
    <span class="update-components-actor__name">Ada Lovelace</span>
  </div>
  <div class="feed-shared-inline-show-more-text">
    <span class="update-components-text">Good product discovery changes what a team decides not to build.</span>
  </div>
  <div class="feed-shared-social-actions"><button aria-label="Comment">Comment</button></div>
  <div class="comments-thread" data-testid="comment-thread">
    <article class="comments-comment-entity" data-urn="urn:li:comment:user_1">
      <a href="/in/current-user"><span class="comments-post-meta__name-text">You</span></a>
      <div class="comments-comment-item__main-content">The strongest signal is often the feature customers never ask for twice.</div>
      <button aria-label="Reply">Reply</button>
      <article class="comments-comment-entity" data-urn="urn:li:comment:incoming_1">
        <a href="/in/grace"><span class="comments-post-meta__name-text">Grace Hopper</span></a>
        <div class="comments-comment-item__main-content">How do you separate a weak request from an unmet need?</div>
        <button aria-label="Reply to Grace Hopper">Reply</button>
        <div class="comments-comment-box__form">
          <div class="ql-editor" contenteditable="true" role="textbox" aria-label="Reply to Grace Hopper"></div>
        </div>
      </article>
    </article>
  </div>
</div>
`;

/** Two reply targets ensure insertion never leaks into the wrong thread. */
export const POST_WITH_MULTIPLE_REPLY_THREADS = `
<div class="feed-shared-update-v2" data-urn="urn:li:activity:reply_post_2">
  <div class="update-components-actor"><span class="update-components-actor__name">Alan Turing</span></div>
  <div class="feed-shared-inline-show-more-text"><span class="update-components-text">Make systems understandable before making them clever.</span></div>
  <div class="feed-shared-social-actions"><button aria-label="Comment">Comment</button></div>
  <div class="comments-thread">
    <article class="comments-comment-entity" data-urn="urn:li:comment:first">
      <span class="comments-post-meta__name-text">First Person</span>
      <div class="comments-comment-item__main-content">First incoming reply.</div>
      <button aria-label="Reply">Reply</button>
      <div class="comments-comment-box__form"><div class="ql-editor" contenteditable="true" role="textbox" aria-label="Reply to First Person"></div></div>
    </article>
    <article class="comments-comment-entity" data-urn="urn:li:comment:second">
      <span class="comments-post-meta__name-text">Second Person</span>
      <div class="comments-comment-item__main-content">Second incoming reply.</div>
      <button aria-label="Reply">Reply</button>
      <div class="comments-comment-box__form"><div class="ql-editor" contenteditable="true" role="textbox" aria-label="Reply to Second Person"></div></div>
    </article>
  </div>
</div>
`;

/**
 * LinkedIn's newer icon-only comment UI has no stable comment entity class or
 * comment URN. The open reply composer includes a plain contenteditable and a
 * blue submit button whose visible text is also "Reply".
 */
export const POST_WITH_MODERN_ICON_REPLY_COMPOSER = `
<div role="listitem" data-view-name="feed-full-update">
  <a href="/in/founder"><span dir="auto">Product Founder</span></a>
  <div data-testid="expandable-text-box">API awareness improves product decisions.</div>
  <div data-view-name="feed-social-actions"><button aria-label="Comment">Comment</button></div>
  <section class="hashed-comments-region">
    <div class="hashed-comment-layout">
      <a href="/in/itunuoluwa"><span dir="auto">Itunuoluwa Akinkugbe</span></a>
      <div class="hashed-comment-subtitle">Senior Business Analyst | Digital Transformation</div>
      <div class="hashed-comment-copy" dir="ltr">
        One subtle point worth adding: API awareness improves user story quality because it pushes BAs to think in terms of events and contracts, not just features.
      </div>
      <div class="hashed-comment-actions">
        <button aria-label="React to comment"><svg data-test-icon="thumbs-up-small"></svg></button>
        <button aria-label="Reply to Itunuoluwa Akinkugbe's comment"><svg data-test-icon="comment-small"></svg></button>
      </div>
      <div class="hashed-reply-composer" data-testid="ui-core-tiptap-text-editor-wrapper">
        <a href="/in/current-user"><span dir="auto">Current user</span></a>
        <div contenteditable="true" role="textbox"><p>Itunuoluwa Akinkugbe</p></div>
        <button class="hashed-reply-submit" type="button">Reply</button>
      </div>
    </div>
  </section>
</div>
`;

/**
 * A classless nested thread matching the current LinkedIn shape: the user's
 * parent comment contains an incoming reply, and the open composer belongs to
 * that incoming reply, but LinkedIn renders the composer as its sibling. The
 * incoming action is icon-only and exposes no useful accessible label.
 */
export const POST_WITH_MODERN_NESTED_REPLY_COMPOSER = `
<div role="listitem" data-view-name="feed-full-update">
  <a href="/in/founder"><span dir="auto">Product Founder</span></a>
  <div data-testid="expandable-text-box">Measuring enabled outcomes changes how teams define delivery.</div>
  <div data-view-name="feed-social-actions"><button aria-label="Comment">Comment</button></div>
  <section class="modern-comments-region">
    <div class="modern-parent-comment">
      <a href="/in/itunuoluwa"><span dir="auto">Itunuoluwa Akinkugbe</span></a>
      <div class="modern-parent-meta">Senior Business Analyst | Digital Transformation | 5h</div>
      <div class="modern-parent-copy" dir="ltr"><span>I suspect the real challenge lies in measuring what you enable rather than what you deliver.</span><button>... more</button></div>
      <div class="modern-parent-actions">
        <button aria-label="React to comment"><svg data-test-icon="thumbs-up-small"></svg>1 reaction</button>
        <button aria-label="Reply to Itunuoluwa Akinkugbe's comment"><svg data-test-icon="comment-small"></svg>1</button>
        <span>44 impressions</span>
      </div>
      <div class="modern-incoming-reply">
        <a href="/in/oyindamola"><span dir="auto">Oyindamola Oye-Daniel</span></a>
        <div class="modern-incoming-meta">Author Senior Product Manager | 4h</div>
        <span class="modern-incoming-time">6h</span>
        <div class="modern-incoming-copy" dir="ltr">
          <a class="modern-inline-mention" href="/in/itunuoluwa">Itunuoluwa Akinkugbe</a>
          <span>uhmmmmmm</span>
          <div>Amazing, thanks for this beautiful contribution. 🙏</div>
        </div>
        <div class="modern-incoming-actions">
          <button aria-label="React to reply"><svg data-test-icon="thumbs-up-small"></svg>2</button>
          <button><svg data-test-icon="reply-small"></svg></button>
        </div>
      </div>
      <div class="modern-reply-composer" data-testid="ui-core-tiptap-text-editor-wrapper">
        <a href="/in/current-user"><span dir="auto">Current user</span></a>
        <div contenteditable="true" role="textbox" aria-label="Add a reply"><p></p></div>
        <button class="modern-reply-submit" type="button">Reply</button>
      </div>
    </div>
  </section>
</div>
`;

/**
 * LinkedIn sometimes renders a standalone overflow/continuation ellipsis as a
 * direction-marked text node while the actual reply is nested separately.
 * The ellipsis must never be mistaken for the member's reply text.
 */
export const POST_WITH_STANDALONE_ELLIPSIS_REPLY_COMPOSER =
  POST_WITH_MODERN_NESTED_REPLY_COMPOSER.replace(
    '<div class="modern-incoming-copy" dir="ltr">',
    '<span class="modern-incoming-overflow" dir="ltr">...</span><div class="modern-incoming-copy" dir="ltr">',
  ).replace(
    '<div>Amazing, thanks for this beautiful contribution. 🙏</div>',
    '<div><span>Amazing, thanks for this beautiful contribution. 🙏</span></div>',
  );

/**
 * The live LinkedIn reply journey can mark the outer parent/reply thread as a
 * native comment. The incoming reply and its composer then live inside that
 * same native boundary, so generic comment extraction sees the whole thread.
 */
export const POST_WITH_NATIVE_WRAPPED_NESTED_REPLY_COMPOSER =
  POST_WITH_MODERN_NESTED_REPLY_COMPOSER.replace(
    '<a href="/in/founder"><span dir="auto">Product Founder</span></a>',
    '<a href="/in/oyindamola"><span dir="auto">Oyindamola Oye-Daniel</span></a>',
  )
    .replace(
      '<div class="modern-parent-comment">',
      '<div class="modern-parent-comment" data-view-name="comment" dir="ltr">',
    )
    .replace(
      '<a href="/in/itunuoluwa"><span dir="auto">Itunuoluwa Akinkugbe</span></a>\n      <div class="modern-parent-meta">Senior Business Analyst | Digital Transformation | 5h</div>',
      '<a class="modern-parent-profile" href="/in/itunuoluwa"><span>Itunuoluwa Akinkugbe</span><span> • You</span><span>Senior Business Analyst | Digital Transformation | AI & Automation | Business Process Improvement | Requirements Analysis | Banking & Fintech | Agile Delivery | Product Strategy</span></a>\n      <div class="modern-parent-meta">Senior Business Analyst | Digital Transformation | 5h</div>',
    )
    .replace(
      '<a href="/in/oyindamola"><span dir="auto">Oyindamola Oye-Daniel</span></a>\n        <div class="modern-incoming-meta">Author Senior Product Manager | 4h</div>',
      '<a class="modern-incoming-profile" href="/in/oyindamola"><span>Oyindamola Oye-Daniel</span><span>Author</span><span>Senior Product Manager | Building Scalable Products in Ambiguous Environments | Execution → Adoption → Growth → Impact | Founder: PM Women’s Hub & Product Bosslady Academy | Author: My Product Journey</span></a>\n        <div class="modern-incoming-meta">Author Senior Product Manager | 4h</div>',
    );

export const POST_WITH_NATIVE_WRAPPED_STANDALONE_ELLIPSIS_REPLY_COMPOSER =
  POST_WITH_NATIVE_WRAPPED_NESTED_REPLY_COMPOSER.replace(
    '<div class="modern-incoming-copy" dir="ltr">',
    '<span class="modern-incoming-overflow" dir="ltr">...</span><div class="modern-incoming-copy" dir="ltr">',
  ).replace(
    '<div>Amazing, thanks for this beautiful contribution. 🙏</div>',
    '<div><span>Amazing, thanks for this beautiful contribution. 🙏</span></div>',
  );

export const FEED_CONTAINER = (innerHtml: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = innerHtml;
  document.body.appendChild(wrapper);
  return wrapper;
};
