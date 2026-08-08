import { afterEach, describe, expect, it } from 'vitest';
import {
  appendEditorText,
  detectExistingText,
  findCommentActionControl,
  findCommentEditor,
  insertComment,
  openCommentEditor,
  replaceEditorText,
  setEditorText,
} from '../insert.js';
import {
  FEED_CONTAINER,
  POST_WITH_OPEN_EDITOR,
  POST_WITH_PREFILLED_EDITOR,
  POST_WITH_TIPTAP_EDITOR,
} from '../../../test/fixtures.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function editorFrom(html: string): { container: HTMLElement; editor: HTMLElement } {
  const root = FEED_CONTAINER(html);
  const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
  const editor = findCommentEditor(container)!;
  return { container, editor };
}

describe('findCommentEditor', () => {
  it('finds the ql-editor inside a comment form', () => {
    const root = FEED_CONTAINER(POST_WITH_OPEN_EDITOR);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    const editor = findCommentEditor(container);
    expect(editor).not.toBeNull();
    expect(editor?.getAttribute('contenteditable')).toBe('true');
  });

  it('returns null when no editor is present', () => {
    const root = FEED_CONTAINER(POST_WITH_PREFILLED_EDITOR);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    container.querySelector('.comments-comment-box__form')?.remove();
    expect(findCommentEditor(container)).toBeNull();
  });

  it('finds the 2026 TipTap comment editor (no ql-editor, no comment-box form)', () => {
    const root = FEED_CONTAINER(POST_WITH_TIPTAP_EDITOR);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    expect(container.querySelector('.ql-editor')).toBeNull();
    const editor = findCommentEditor(container);
    expect(editor).not.toBeNull();
    expect(editor?.getAttribute('aria-label')).toBe('Text editor for creating comment');
  });
});

describe('findCommentActionControl', () => {
  it('never returns InsightReply\'s own button, whose aria-label contains "comment"', () => {
    const root = FEED_CONTAINER(POST_WITH_TIPTAP_EDITOR);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;

    const own = document.createElement('button');
    own.className = 'insightreply-button';
    own.setAttribute('aria-label', 'Generate AI comment suggestions with InsightReply');
    own.textContent = '✨ AI Comment';
    container.prepend(own);

    const action = findCommentActionControl(container);
    expect(action).not.toBeNull();
    expect(action?.classList.contains('insightreply-button')).toBe(false);
    expect(action?.textContent?.trim()).toBe('Comment');
  });

  it('matches a Comment control that has no aria-label at all', () => {
    const root = FEED_CONTAINER(POST_WITH_TIPTAP_EDITOR);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    const action = findCommentActionControl(container);
    expect(action?.getAttribute('aria-label')).toBeNull();
    expect(action?.textContent?.trim()).toBe('Comment');
  });

  it('does not click its own button when opening the editor', () => {
    const root = FEED_CONTAINER(POST_WITH_TIPTAP_EDITOR);
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    container.querySelector('[data-testid="ui-core-tiptap-text-editor-wrapper"]')?.remove();

    const own = document.createElement('button');
    own.className = 'insightreply-button';
    own.setAttribute('aria-label', 'Generate AI comment suggestions with InsightReply');
    let ownClicks = 0;
    own.addEventListener('click', () => { ownClicks += 1; });
    container.prepend(own);

    let commentClicks = 0;
    const commentButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Comment',
    )!;
    commentButton.addEventListener('click', () => { commentClicks += 1; });

    openCommentEditor(container);
    expect(ownClicks).toBe(0);
    expect(commentClicks).toBe(1);
  });
});

describe('detectExistingText', () => {
  it('returns empty string for a fresh editor', () => {
    const { editor } = editorFrom(POST_WITH_OPEN_EDITOR);
    expect(detectExistingText(editor)).toBe('');
  });

  it('returns the existing text when present', () => {
    const { editor } = editorFrom(POST_WITH_PREFILLED_EDITOR);
    expect(detectExistingText(editor)).toBe('Existing draft text here');
  });
});

describe('insertComment', () => {
  it('inserts into an empty editor with mode auto', () => {
    const { container } = editorFrom(POST_WITH_OPEN_EDITOR);
    const result = insertComment(container, 'A fresh comment.', 'auto');
    expect(result).toEqual({ ok: true, hadExistingText: false });
    expect(container.querySelector('.ql-editor')?.textContent).toBe('A fresh comment.');
  });

  it('reports existing text without overwriting in mode auto', () => {
    const { container, editor } = editorFrom(POST_WITH_PREFILLED_EDITOR);
    const result = insertComment(container, 'A fresh comment.', 'auto');
    expect(result).toEqual({ ok: true, hadExistingText: true });
    expect(editor.textContent).toBe('Existing draft text here');
  });

  it('replaces existing text in mode replace', () => {
    const { container, editor } = editorFrom(POST_WITH_PREFILLED_EDITOR);
    const result = insertComment(container, 'A fresh comment.', 'replace');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hadExistingText).toBe(true);
    expect(editor.textContent).toBe('A fresh comment.');
  });

  it('appends to existing text in mode append', () => {
    const { container, editor } = editorFrom(POST_WITH_PREFILLED_EDITOR);
    const result = insertComment(container, 'A fresh comment.', 'append');
    expect(result.ok).toBe(true);
    expect(editor.textContent).toBe('Existing draft text here A fresh comment.');
  });

  it('returns an error when no editor exists', () => {
    const root = FEED_CONTAINER(POST_WITH_OPEN_EDITOR.replace('.ql-editor', 'div.ql-editor'));
    const container = root.querySelector('.feed-shared-update-v2') as HTMLElement;
    container.querySelector('.ql-editor')?.remove();
    const result = insertComment(container, 'Hello', 'auto');
    expect(result).toEqual({ ok: false, code: 'COMMENT_EDITOR_NOT_FOUND', message: expect.any(String) });
  });
});

describe('plain-text helpers', () => {
  it('setEditorText writes plain text without HTML parsing', () => {
    const { editor } = editorFrom(POST_WITH_OPEN_EDITOR);
    setEditorText(editor, '<img src=x onerror=alert(1)> plain text');
    expect(editor.textContent).toBe('<img src=x onerror=alert(1)> plain text');
    expect(editor.querySelector('img')).toBeNull();
  });

  it('appendEditorText joins with a space', () => {
    const { editor } = editorFrom(POST_WITH_OPEN_EDITOR);
    appendEditorText(editor, 'second part');
    expect(editor.textContent).toBe('second part');
  });

  it('replaceEditorText overwrites content', () => {
    const { editor } = editorFrom(POST_WITH_PREFILLED_EDITOR);
    replaceEditorText(editor, 'only this');
    expect(editor.textContent).toBe('only this');
  });
});
