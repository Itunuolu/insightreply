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
  POST_WITH_MULTIPLE_REPLY_THREADS,
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
    expect(extractCommentText(incoming)).toBe('How do you separate a weak request from an unmet need?');
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
        parentCommentText: 'The strongest signal is often the feature customers never ask for twice.',
      },
    });
    expect(resolveReplyTarget('urn:li:comment:incoming_1')).toBe(incoming);
  });
});

describe('AI Reply button', () => {
  it('does not add a self-reply action to the root comment', () => {
    const root = FEED_CONTAINER(POST_WITH_REPLY_THREAD);
    const parent = root.querySelector('[data-urn="urn:li:comment:user_1"]') as HTMLElement;
    injectReplyButton(parent);
    expect(parent.querySelector(':scope > .insightreply-reply-wrap')).toBeNull();
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
