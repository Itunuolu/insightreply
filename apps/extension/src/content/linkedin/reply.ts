import type { SelectedPost } from '@insightreply/shared';
import { extractPostData, findPostContainers } from './adapter.js';
import { dispatchSelection, showToast } from './button.js';
import { setEditorText, appendEditorText, detectExistingText } from './insert.js';
import {
  COMMENT_AUTHOR_SELECTORS,
  COMMENT_CONTAINER_SELECTORS,
  COMMENT_TEXT_SELECTORS,
  DYNAMIC_COMMENT_ATTRIBUTE,
  OWN_ELEMENT_CLASS,
  REPLY_ACTION_SELECTORS,
  REPLY_EDITOR_SELECTORS,
  REPLY_MOUNTED_ATTRIBUTE,
  REPLY_TARGET_ATTRIBUTE,
  matchesReplyActionText,
} from './selectors.js';

const REPLY_BUTTON_TEXT = '✨ AI Reply';

const replyRegistry = new Map<string, HTMLElement>();
const replyLocators = new Map<
  string,
  { postId: string; authorName?: string; text: string }
>();

const COMMENT_CONTAINER_SELECTOR = COMMENT_CONTAINER_SELECTORS.join(',');
const NATIVE_COMMENT_CONTAINER_SELECTOR = COMMENT_CONTAINER_SELECTORS.filter(
  (selector) => selector !== `[${DYNAMIC_COMMENT_ATTRIBUTE}]`,
).join(',');
const REPLY_ACTION_SELECTOR = REPLY_ACTION_SELECTORS.join(',');
const REPLY_EDITOR_SELECTOR = REPLY_EDITOR_SELECTORS.join(',');

function isEditorElement(element: Element): boolean {
  return element.matches(REPLY_EDITOR_SELECTOR) || Boolean(element.closest(REPLY_EDITOR_SELECTOR));
}

function looksLikeReplySubmit(element: HTMLElement): boolean {
  if (element.closest('form, [data-testid="ui-core-tiptap-text-editor-wrapper"]')) return true;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    matchesReplyActionText(element.textContent) &&
    (style.borderRadius === '9999px' || rect.width >= 64 || element.className.includes('submit'))
  );
}

function belongsToComment(element: Element, container: HTMLElement): boolean {
  return element.closest<HTMLElement>(COMMENT_CONTAINER_SELECTOR) === container;
}

function isVisible(element: Element): boolean {
  if (!element.isConnected) return false;
  if (!(element instanceof HTMLElement)) return true;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function cleanText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  for (const selector of [
    `.${OWN_ELEMENT_CLASS}`,
    '.insightreply-reply-button',
    '.insightreply-reply-wrap',
    ...REPLY_EDITOR_SELECTORS,
    ...COMMENT_CONTAINER_SELECTORS,
  ]) {
    for (const element of clone.querySelectorAll<HTMLElement>(selector)) element.remove();
  }
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function findCommentContainers(root: ParentNode = document): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const comments: HTMLElement[] = [];
  for (const selector of COMMENT_CONTAINER_SELECTORS) {
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
      if (!seen.has(element) && isVisible(element)) {
        seen.add(element);
        comments.push(element);
      }
    }
  }
  for (const action of root.querySelectorAll<HTMLElement>(REPLY_ACTION_SELECTOR)) {
    if (
      action.classList.contains(OWN_ELEMENT_CLASS) ||
      !isVisible(action) ||
      isEditorElement(action) ||
      looksLikeReplySubmit(action)
    ) {
      continue;
    }
    const container = deriveCommentContainer(action);
    if (container && !seen.has(container)) {
      container.setAttribute(DYNAMIC_COMMENT_ATTRIBUTE, 'true');
      seen.add(container);
      comments.push(container);
    }
  }
  return comments;
}

function deriveCommentContainer(action: HTMLElement): HTMLElement | null {
  // A dynamic marker can belong to an outer parent comment. Treating it as a
  // native boundary would collapse every nested icon action into that parent.
  const known = action.closest<HTMLElement>(NATIVE_COMMENT_CONTAINER_SELECTOR);
  if (known) return known;
  const post = findPostContainers().find((container) => container.contains(action));
  if (!post) return null;

  let candidate = action.parentElement;
  while (candidate && candidate !== post) {
    const profileLinks = Array.from(
      candidate.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]'),
    );
    const hasAuthor = profileLinks.some((link) => !isEditorElement(link));
    const editor = Array.from(candidate.querySelectorAll<HTMLElement>(REPLY_EDITOR_SELECTOR)).find(
      (element) => isVisible(element),
    );
    if (hasAuthor && editor && candidate.contains(editor)) return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}

export function extractCommentText(container: HTMLElement): string {
  for (const selector of COMMENT_TEXT_SELECTORS) {
    const candidate = Array.from(container.querySelectorAll<HTMLElement>(selector)).find(
      (element) => belongsToComment(element, container),
    );
    if (!candidate) continue;
    const text = cleanText(candidate);
    if (text) return text;
  }
  return cleanText(container);
}

export function extractCommentAuthor(container: HTMLElement): string | undefined {
  for (const selector of COMMENT_AUTHOR_SELECTORS) {
    const candidate = Array.from(container.querySelectorAll<HTMLElement>(selector)).find(
      (element) => belongsToComment(element, container),
    );
    const text = candidate?.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.length <= 200) return text;
  }
  return undefined;
}

function findReplyAction(container: HTMLElement): HTMLElement | null {
  for (const selector of REPLY_ACTION_SELECTORS) {
    const candidate = Array.from(container.querySelectorAll<HTMLElement>(selector)).find(
      (element) => belongsToComment(element, container),
    );
    if (
      candidate &&
      !candidate.classList.contains(OWN_ELEMENT_CLASS) &&
      !isEditorElement(candidate) &&
      !looksLikeReplySubmit(candidate) &&
      isVisible(candidate)
    ) {
      return candidate;
    }
  }
  return Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
    (candidate) =>
      !candidate.classList.contains(OWN_ELEMENT_CLASS) &&
      belongsToComment(candidate, container) &&
      matchesReplyActionText(candidate.textContent) &&
      !isEditorElement(candidate) &&
      !looksLikeReplySubmit(candidate) &&
      isVisible(candidate),
  ) ?? null;
}

function nativeCommentId(container: HTMLElement): string | undefined {
  for (const attribute of ['data-id', 'data-urn', 'data-comment-id']) {
    const value = container.getAttribute(attribute)?.trim();
    if (value) return value;
  }
  const descendant = container.querySelector<HTMLElement>(
    '[data-id^="urn:li:comment"], [data-urn^="urn:li:comment"], [data-comment-id]',
  );
  if (!descendant) return undefined;
  return nativeCommentId(descendant);
}

function generatedReplyTargetId(postId: string, author: string | undefined, text: string): string {
  const source = `${postId}\u0000${author ?? ''}\u0000${text}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `ir-reply-${hash.toString(36)}`;
}

function registerReplyTarget(
  targetId: string,
  container: HTMLElement,
  locator?: { postId: string; authorName?: string; text: string },
): void {
  container.setAttribute(REPLY_TARGET_ATTRIBUTE, targetId);
  replyRegistry.set(targetId, container);
  if (locator) replyLocators.set(targetId, locator);
}

export function resolveReplyTarget(targetId: string): HTMLElement | null {
  const registered = replyRegistry.get(targetId);
  if (registered?.isConnected) return registered;
  for (const container of findCommentContainers()) {
    if (
      container.getAttribute(REPLY_TARGET_ATTRIBUTE) === targetId ||
      nativeCommentId(container) === targetId
    ) {
      registerReplyTarget(targetId, container);
      return container;
    }
  }
  const locator = replyLocators.get(targetId);
  if (locator) {
    const matching = findCommentContainers().find((container) => {
      if (extractCommentText(container) !== locator.text) return false;
      if (locator.authorName && extractCommentAuthor(container) !== locator.authorName) return false;
      const postContainer = findPostContainers().find((post) => post.contains(container));
      if (!postContainer) return false;
      return extractPostData(postContainer).post?.postId === locator.postId;
    });
    if (matching) {
      registerReplyTarget(targetId, matching, locator);
      return matching;
    }
  }
  return null;
}

function findParentComment(container: HTMLElement): HTMLElement | null {
  const parent = container.parentElement?.closest<HTMLElement>(COMMENT_CONTAINER_SELECTOR);
  if (parent && parent !== container) return parent;
  const thread = container.closest<HTMLElement>('.comments-thread, [data-testid="comment-thread"]');
  if (!thread) return null;
  const comments = findCommentContainers(thread);
  const index = comments.indexOf(container);
  return index > 0 ? comments[index - 1] ?? null : null;
}

function isNestedReply(container: HTMLElement): boolean {
  const parent = container.parentElement?.closest<HTMLElement>(COMMENT_CONTAINER_SELECTOR);
  return Boolean(parent && parent !== container);
}

function findOwnReplyWrap(container: HTMLElement): HTMLElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLElement>('.insightreply-reply-wrap')).find(
      (element) => belongsToComment(element, container),
    ) ?? null
  );
}

export function extractReplySelection(container: HTMLElement): SelectedPost | null {
  const incomingText = extractCommentText(container);
  if (!incomingText || incomingText.length > 4_000) return null;

  const postContainer = findPostContainers().find((post) => post.contains(container)) ?? null;
  if (!postContainer) return null;
  const post = extractPostData(postContainer).post;
  if (!post) return null;

  const incomingAuthor = extractCommentAuthor(container);
  const parent = findParentComment(container);
  const parentText = parent ? extractCommentText(parent) : undefined;
  const parentAuthor = parent ? extractCommentAuthor(parent) : undefined;
  const targetId =
    nativeCommentId(container) ?? generatedReplyTargetId(post.postId, incomingAuthor, incomingText);
  registerReplyTarget(targetId, container, {
    postId: post.postId,
    authorName: incomingAuthor,
    text: incomingText,
  });

  return {
    ...post,
    selectedAt: new Date().toISOString(),
    replyContext: {
      targetId,
      authorName: incomingAuthor,
      text: incomingText,
      parentCommentAuthorName: parentAuthor,
      parentCommentText: parentText,
    },
  };
}

function createReplyButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = REPLY_BUTTON_TEXT;
  button.className = `${OWN_ELEMENT_CLASS} insightreply-reply-button`;
  button.setAttribute('aria-label', 'Generate AI reply suggestions with InsightReply');
  button.style.cssText = [
    'all:unset',
    'display:inline-flex',
    'align-items:center',
    'box-sizing:border-box',
    'min-height:24px',
    'padding:4px 9px',
    'margin-left:8px',
    'border-radius:14px',
    'border:1px solid #b58b14',
    'color:#8a6810',
    'font:600 11px/1.2 Inter,system-ui,sans-serif',
    'cursor:pointer',
  ].join(';');
  return button;
}

export function injectReplyButton(container: HTMLElement): void {
  const nested = isNestedReply(container);
  const hasOpenEditor = Boolean(findReplyEditor(container));
  if (!nested && !hasOpenEditor) {
    findOwnReplyWrap(container)?.remove();
    container.removeAttribute(REPLY_MOUNTED_ATTRIBUTE);
    return;
  }
  if (container.hasAttribute(REPLY_MOUNTED_ATTRIBUTE)) return;
  const replyAction = findReplyAction(container);
  if (!replyAction) return;

  const button = createReplyButton();
  const wrap = document.createElement('span');
  wrap.className = 'insightreply-reply-wrap';
  wrap.appendChild(button);
  replyAction.insertAdjacentElement('afterend', wrap);
  container.setAttribute(REPLY_MOUNTED_ATTRIBUTE, 'true');

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handleReplyButtonClick(container, button);
  });
}

async function handleReplyButtonClick(
  container: HTMLElement,
  button: HTMLButtonElement,
): Promise<void> {
  const post = extractReplySelection(container);
  if (!post) {
    showToast(
      'InsightReply could not read this LinkedIn reply. Close and reopen the reply box, then try again.',
    );
    return;
  }

  button.setAttribute('disabled', 'true');
  try {
    const opened = await dispatchSelection(post);
    if (!opened) {
      showToast('Reply selected. Open InsightReply from the toolbar icon to continue.');
    }
  } catch {
    showToast('Could not open InsightReply. Open it from the toolbar icon and try again.');
  } finally {
    button.removeAttribute('disabled');
  }
}

function isEditable(element: HTMLElement): boolean {
  return element.isContentEditable || element.getAttribute('contenteditable') === 'true';
}

export function findReplyEditor(container: HTMLElement): HTMLElement | null {
  for (const selector of REPLY_EDITOR_SELECTORS) {
    const candidates = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const own = candidates.find(
      (candidate) =>
        belongsToComment(candidate, container) && isEditable(candidate) && isVisible(candidate),
    );
    if (own) return own;
  }
  const siblingScope = container.parentElement;
  if (!siblingScope) return null;
  for (const selector of REPLY_EDITOR_SELECTORS) {
    const candidate = Array.from(siblingScope.querySelectorAll<HTMLElement>(selector)).find(
      (element) => {
        const owner = element.closest<HTMLElement>(COMMENT_CONTAINER_SELECTOR);
        return (!owner || owner === container) && isEditable(element) && isVisible(element);
      },
    );
    if (candidate) return candidate;
  }
  return null;
}

export function openReplyEditor(container: HTMLElement): HTMLElement | null {
  const existing = findReplyEditor(container);
  if (existing) return existing;
  findReplyAction(container)?.click();
  return null;
}

export async function waitForReplyEditor(
  container: HTMLElement,
  timeoutMs = 4_000,
): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const editor = findReplyEditor(container);
    if (editor) return editor;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

export function insertReply(
  editor: HTMLElement,
  text: string,
  mode: 'replace' | 'append' | 'auto',
): { ok: true; hadExistingText: boolean } {
  const hadExistingText = detectExistingText(editor).length > 0;
  if (mode === 'auto' && hadExistingText) return { ok: true, hadExistingText };
  if (mode === 'append') appendEditorText(editor, text);
  else setEditorText(editor, text);
  return { ok: true, hadExistingText };
}
