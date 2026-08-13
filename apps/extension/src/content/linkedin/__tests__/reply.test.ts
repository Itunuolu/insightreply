import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractCommentAuthor,
  extractCommentText,
  extractReplySelection,
  findCommentContainers,
  findReplyEditor,
  injectReplyButton,
  insertReply,
  resolveReplyTarget,
} from '../reply.js';
import {
  FEED_CONTAINER,
  POST_WITH_MODERN_ICON_REPLY_COMPOSER,
  POST_WITH_MODERN_NESTED_REPLY_COMPOSER,
  POST_WITH_MULTIPLE_REPLY_THREADS,
  POST_WITH_NATIVE_WRAPPED_NESTED_REPLY_COMPOSER,
  POST_WITH_REPLY_THREAD,
} from '../../../test/fixtures.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('reply discovery and extraction', () => {
  it('finds comment entities without treating them as posts', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    expect(findCommentContainers(root)).toHaveLength(2);
  });

  it('extracts only the selected incoming reply, excluding nested editor text', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    expect(extractCommentAuthor(incoming)).toBe('Grace Hopper');
    expect(extractCommentText(incoming)).toBe(
      'How do you separate a weak request from an unmet need?',
    );
  });

  it('builds a contextual selection with the post, parent comment, and reply target', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    const selection = extractReplySelection(incoming);
    expect(selection).toMatchObject({
      postId: 'urn:li:activity:reply_post_1',
      authorName: 'Ada Lovelace',
      replyContext: {
        targetId: 'urn:li:comment:incoming_1',
        authorName: 'Grace Hopper',
        text: 'How do you separate a weak request from an unmet need?',
        parentCommentAuthorName: 'You',
        parentCommentText:
          'The strongest signal is often the feature customers never ask for twice.',
      },
    });
    expect(resolveReplyTarget('urn:li:comment:incoming_1')).toBe(incoming);
  });

  it('discovers the modern icon-only comment layout without stable comment classes', () => {
    const root = FEED_CONTAINER(POST_WITH_MODERN_ICON_REPLY_COMPOSER);
    const comments = findCommentContainers(root);
    expect(comments).toHaveLength(1);
    const comment = comments[0]!;
    expect(extractCommentAuthor(comment)).toBe('Itunuoluwa Akinkugbe');
    expect(extractCommentText(comment)).toBe(
      'One subtle point worth adding: API awareness improves user story quality because it pushes BAs to think in terms of events and contracts, not just features.',
    );

    injectReplyButton(comment);
    const button = comment.querySelector('.insightreply-reply-button');
    expect(button).not.toBeNull();
    expect(
      comment.querySelector(
        '.hashed-reply-composer .insightreply-reply-wrap + .hashed-reply-submit',
      ),
    ).not.toBeNull();
    expect(comment.querySelector('.hashed-comment-actions + .insightreply-reply-wrap')).toBeNull();
    expect(comment.querySelector('.hashed-reply-submit + .insightreply-reply-wrap')).toBeNull();

    const selection = extractReplySelection(comment);
    expect(selection).toMatchObject({
      authorName: 'Product Founder',
      replyContext: {
        authorName: 'Itunuoluwa Akinkugbe',
        text: 'One subtle point worth adding: API awareness improves user story quality because it pushes BAs to think in terms of events and contracts, not just features.',
      },
    });
    expect(selection?.replyContext?.parentCommentAuthorName).toBeUndefined();
    expect(selection?.replyContext?.parentCommentText).toBeUndefined();
  });

  it('owns a classless nested composer by the incoming reply, not the parent comment', () => {
    const root = FEED_CONTAINER(POST_WITH_MODERN_NESTED_REPLY_COMPOSER);
    const comments = findCommentContainers(root);
    expect(comments).toHaveLength(2);

    for (const comment of comments) injectReplyButton(comment);

    const incoming = root.querySelector('.modern-incoming-reply') as HTMLElement;
    const composer = root.querySelector('.modern-reply-composer') as HTMLElement;
    expect(root.querySelector('.modern-parent-actions + .insightreply-reply-wrap')).toBeNull();
    expect(root.querySelector('.modern-incoming-actions + .insightreply-reply-wrap')).toBeNull();
    expect(composer.querySelectorAll('.insightreply-reply-button')).toHaveLength(1);
    expect(
      composer.querySelector('.insightreply-reply-wrap + .modern-reply-submit'),
    ).not.toBeNull();
    const selection = extractReplySelection(incoming);
    expect(selection).toMatchObject({
      replyContext: {
        authorName: 'Oyindamola Oye-Daniel',
        text: 'Amazing, thanks for this beautiful contribution. 🙏',
        parentCommentAuthorName: 'Itunuoluwa Akinkugbe',
        parentCommentText:
          'I suspect the real challenge lies in measuring what you enable rather than what you deliver.',
      },
    });
    const serialized = JSON.stringify(selection?.replyContext);
    expect(serialized).not.toContain('Senior Business Analyst');
    expect(serialized).not.toContain('impressions');
    expect(serialized).not.toContain('uhmmmmmm');
    expect(serialized).not.toContain('reaction');
  });

  it('bounds an incoming reply when LinkedIn marks the whole thread as one native comment', () => {
    const root = FEED_CONTAINER(POST_WITH_NATIVE_WRAPPED_NESTED_REPLY_COMPOSER);
    const comments = findCommentContainers(root);
    expect(comments).toHaveLength(1);

    const thread = comments[0]!;
    injectReplyButton(thread);
    expect(
      root.querySelector('.modern-reply-composer button.insightreply-reply-button'),
    ).not.toBeNull();

    const selection = extractReplySelection(thread);
    expect(selection).toMatchObject({
      replyContext: {
        authorName: 'Oyindamola Oye-Daniel',
        text: 'Amazing, thanks for this beautiful contribution. 🙏',
        parentCommentAuthorName: 'Itunuoluwa Akinkugbe',
        parentCommentText:
          'I suspect the real challenge lies in measuring what you enable rather than what you deliver.',
      },
    });
    expect(JSON.stringify(selection?.replyContext)).not.toMatch(
      /Senior Business Analyst|impressions|uhmmmmmm|reaction/,
    );
  });

  it('recomputes bounded context at click time when discovery did not prime the container', () => {
    const root = FEED_CONTAINER(POST_WITH_NATIVE_WRAPPED_NESTED_REPLY_COMPOSER);
    const thread = root.querySelector('[data-view-name="comment"]') as HTMLElement;

    const selection = extractReplySelection(thread);
    expect(selection).toMatchObject({
      replyContext: {
        authorName: 'Oyindamola Oye-Daniel',
        text: 'Amazing, thanks for this beautiful contribution. 🙏',
        parentCommentAuthorName: 'Itunuoluwa Akinkugbe',
        parentCommentText:
          'I suspect the real challenge lies in measuring what you enable rather than what you deliver.',
      },
    });
  });
});

describe('AI Reply button', () => {
  it('does not add a root-comment action until its reply editor is open', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const parent = root.querySelector('[data-urn="urn:li:comment:user_1"]') as HTMLElement;
    injectReplyButton(parent);
    expect(parent.querySelector(':scope > .insightreply-reply-wrap')).toBeNull();
  });

  it('adds a root-comment action while its reply editor is open and removes it when closed', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const parent = root.querySelector('[data-urn="urn:li:comment:user_1"]') as HTMLElement;
    const form = document.createElement('div');
    form.className = 'comments-comment-box__form';
    form.innerHTML =
      '<div class="ql-editor" contenteditable="true" role="textbox" aria-label="Reply"></div>';
    parent.appendChild(form);

    findCommentContainers(root);
    injectReplyButton(parent);
    expect(
      Array.from(parent.querySelectorAll('.insightreply-reply-wrap')).filter(
        (element) => element.closest('[data-urn^="urn:li:comment"]') === parent,
      ),
    ).toHaveLength(1);

    form.remove();
    injectReplyButton(parent);
    expect(
      Array.from(parent.querySelectorAll('.insightreply-reply-wrap')).filter(
        (element) => element.closest('[data-urn^="urn:li:comment"]') === parent,
      ),
    ).toHaveLength(0);
  });

  it('injects exactly one button beside a LinkedIn Reply action', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    injectReplyButton(incoming);
    injectReplyButton(incoming);
    expect(incoming.querySelectorAll('.insightreply-reply-button')).toHaveLength(1);
  });

  it('dispatches the reply selection when clicked', async () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    injectReplyButton(incoming);
    const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValue({ ok: true, opened: true });
    (incoming.querySelector('.insightreply-reply-button') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'IR_SELECT_POST',
        post: expect.objectContaining({
          replyContext: expect.objectContaining({ targetId: 'urn:li:comment:incoming_1' }),
        }),
      }),
    );
  });

  it('does not show a false sidebar error when the reply selection succeeded', async () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    injectReplyButton(incoming);
    const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValue({ ok: true, opened: false });

    (incoming.querySelector('.insightreply-reply-button') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.insightreply-toast')).toBeNull();
  });

  it('shows an error when the reply selection itself fails', async () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    injectReplyButton(incoming);
    const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValue({ ok: false, message: 'Selection storage failed.' });

    (incoming.querySelector('.insightreply-reply-button') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.insightreply-toast')?.textContent).toContain(
      'could not select this reply',
    );
  });

  it('shows an error instead of silently returning when reply context cannot be extracted', async () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    injectReplyButton(incoming);
    root.querySelector('.feed-shared-inline-show-more-text')?.remove();

    (incoming.querySelector('.insightreply-reply-button') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.insightreply-toast')?.textContent).toContain(
      'could not read this LinkedIn reply',
    );
  });
});

describe('reply editor targeting', () => {
  it('finds and inserts into the selected reply editor', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    const editor = findReplyEditor(incoming)!;
    expect(insertReply(editor, 'A contextual response.', 'auto')).toEqual({
      ok: true,
      hadExistingText: false,
    });
    expect(editor.textContent).toBe('A contextual response.');
  });

  it('never inserts into a sibling reply editor', () => {
    const root = FEED_CONTAINER(POST_WITH_MULTIPLE_REPLY_THREADS);
    const first = root.querySelector('[data-urn="urn:li:comment:first"]') as HTMLElement;
    const second = root.querySelector('[data-urn="urn:li:comment:second"]') as HTMLElement;
    const firstEditor = findReplyEditor(first)!;
    const secondEditor = findReplyEditor(second)!;
    insertReply(secondEditor, 'Only the second thread receives this.', 'auto');
    expect(firstEditor.textContent).toBe('');
    expect(secondEditor.textContent).toBe('Only the second thread receives this.');
  });

  it('does not borrow a sibling editor when the selected comment has none', () => {
    const root = FEED_CONTAINER(POST_WITH_MULTIPLE_REPLY_THREADS);
    const first = root.querySelector('[data-urn="urn:li:comment:first"]') as HTMLElement;
    const second = root.querySelector('[data-urn="urn:li:comment:second"]') as HTMLElement;
    first.querySelector('.comments-comment-box__form')?.remove();
    expect(findReplyEditor(first)).toBeNull();
    expect(findReplyEditor(second)).not.toBeNull();
  });

  it('preserves an existing draft in auto mode', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const incoming = root.querySelector('[data-urn="urn:li:comment:incoming_1"]') as HTMLElement;
    const editor = findReplyEditor(incoming)!;
    editor.textContent = 'My unfinished reply';
    expect(insertReply(editor, 'Replacement', 'auto')).toEqual({ ok: true, hadExistingText: true });
    expect(editor.textContent).toBe('My unfinished reply');
  });
});
