import {
  COMMENT_ACTION_SELECTORS,
  COMMENT_EDITOR_SELECTORS,
  OWN_ELEMENT_CLASS,
  matchesCommentActionText,
} from './selectors.js';

/** Robust editable check (jsdom does not implement isContentEditable). */
function isEditable(element: HTMLElement): boolean {
  return element.isContentEditable || element.getAttribute('contenteditable') === 'true';
}

/** True for elements InsightReply injected itself — never treat these as LinkedIn controls. */
function isOwnElement(element: Element): boolean {
  return element.classList.contains(OWN_ELEMENT_CLASS);
}

/** Finds an open comment editor inside a post container. */
export function findCommentEditor(container: HTMLElement): HTMLElement | null {
  for (const selector of COMMENT_EDITOR_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (element && isEditable(element)) return element;
  }
  const any = container.querySelector<HTMLElement>(
    'form.comments-comment-box__form [contenteditable="true"], .comment-editor [contenteditable="true"]',
  );
  return any && isEditable(any) ? any : null;
}

/**
 * Finds LinkedIn's own "Comment" control inside a post container.
 * The 2026 feed renders it without an aria-label, so a text match is needed;
 * InsightReply's own button is excluded because its aria-label contains the
 * word "comment" and would otherwise be the first (and only) match.
 */
export function findCommentActionControl(container: HTMLElement): HTMLElement | null {
  for (const selector of COMMENT_ACTION_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (element && !isOwnElement(element)) return element;
  }
  const byText = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
    (el) => !isOwnElement(el) && matchesCommentActionText(el.textContent),
  );
  return byText ?? null;
}

/**
 * Opens the comment editor by clicking LinkedIn's Comment action.
 * Returns the editor if it is already open.
 */
export function openCommentEditor(container: HTMLElement): HTMLElement | null {
  const editor = findCommentEditor(container);
  if (editor) return editor;
  findCommentActionControl(container)?.click();
  return null;
}

/** Waits (bounded) for the comment editor to render after opening it. */
export async function waitForCommentEditor(
  container: HTMLElement,
  timeoutMs = 4000,
): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const editor = findCommentEditor(container);
    if (editor) return editor;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

/** Returns the current plain text in the editor (empty string if none). */
export function detectExistingText(editor: HTMLElement): string {
  return (editor.textContent ?? '').trim();
}

function writePlainText(editor: HTMLElement, text: string): void {
  // Plain-text insertion only — never innerHTML; comment text is untrusted.
  editor.textContent = text;
}

/** Sets the editor content to plain text (safe, no HTML parsing). */
export function setEditorText(editor: HTMLElement, text: string): void {
  writePlainText(editor, text);
  moveCursorToEnd(editor);
  dispatchEditorEvents(editor);
}

/** Replaces the editor content (same as setEditorText, explicit naming). */
export function replaceEditorText(editor: HTMLElement, text: string): void {
  setEditorText(editor, text);
}

/** Appends text to the existing editor content with a space separator. */
export function appendEditorText(editor: HTMLElement, text: string): void {
  const existing = detectExistingText(editor);
  insertByAppending(editor, existing, text);
}

function moveCursorToEnd(editor: HTMLElement): void {
  editor.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Dispatches the input events LinkedIn listens for so its editor state
 * (and the Post button) picks up the inserted text.
 */
function dispatchEditorEvents(editor: HTMLElement): void {
  const options = { bubbles: true, cancelable: true, composed: true };
  editor.dispatchEvent(new InputEvent('beforeinput', options));
  editor.dispatchEvent(new InputEvent('input', options));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
  editor.dispatchEvent(new Event('keyup', { bubbles: true }));
}

function insertIntoEmptyEditor(editor: HTMLElement, text: string): void {
  writePlainText(editor, text);
  moveCursorToEnd(editor);
  dispatchEditorEvents(editor);
}

function insertByAppending(editor: HTMLElement, existing: string, text: string): void {
  const needsSeparator =
    existing.trim().length > 0 && !existing.endsWith(' ') && !text.startsWith(' ');
  const separator = needsSeparator ? ' ' : '';
  writePlainText(editor, `${existing}${separator}${text}`);
  moveCursorToEnd(editor);
  dispatchEditorEvents(editor);
}

/**
 * Inserts `text` into the post's comment editor.
 *  - mode 'replace': overwrite existing content
 *  - mode 'append': append after existing content
 *  - mode 'auto': insert only when empty; otherwise report hadExistingText
 * Never submits the comment.
 */
export function insertComment(
  container: HTMLElement,
  text: string,
  mode: 'replace' | 'append' | 'auto',
): { ok: true; hadExistingText: boolean } | { ok: false; code: string; message: string } {
  const editor = findCommentEditor(container);
  if (!editor) {
    return {
      ok: false,
      code: 'COMMENT_EDITOR_NOT_FOUND',
      message: "Comment editor not found. Open the post's comment box and try again.",
    };
  }

  const existing = detectExistingText(editor);
  const hadExistingText = existing.length > 0;

  if (mode === 'auto' && hadExistingText) {
    return { ok: true, hadExistingText };
  }
  if (mode === 'append') {
    insertByAppending(editor, existing, text);
  } else {
    insertIntoEmptyEditor(editor, text);
  }

  return { ok: true, hadExistingText };
}
