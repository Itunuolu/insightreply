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
const editorTargetRegistry = new WeakMap<HTMLElement, HTMLElement>();
const replyWrapRegistry = new WeakMap<HTMLElement, HTMLElement>();
const replyContextRegistry = new WeakMap<
  HTMLElement,
  {
    authorName?: string;
    text: string;
    parentCommentAuthorName?: string;
    parentCommentText?: string;
  }
>();
const replyLocators = new Map<string, { postId: string; authorName?: string; text: string }>();

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

function normalizeInlineText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function findComposerScope(editor: HTMLElement): HTMLElement {
  return (
    editor.closest<HTMLElement>(
      '[data-testid="ui-core-tiptap-text-editor-wrapper"], .comments-comment-box__form, form',
    ) ??
    editor.parentElement ??
    editor
  );
}

function precedes(element: Element, reference: Element): boolean {
  return Boolean(element.compareDocumentPosition(reference) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function branchUnder(ancestor: HTMLElement, descendant: HTMLElement): HTMLElement | null {
  let branch = descendant;
  while (branch.parentElement && branch.parentElement !== ancestor) branch = branch.parentElement;
  return branch.parentElement === ancestor ? branch : null;
}

function profileLinkAuthor(link: HTMLAnchorElement): string | undefined {
  const leafSpans = Array.from(link.querySelectorAll<HTMLElement>('span')).filter(
    (span) => !span.querySelector('span'),
  );
  const candidates = [
    link.querySelector<HTMLElement>('[data-testid="comment-author-name"]'),
    link.querySelector<HTMLElement>('[data-view-name="comment-author"]'),
    link.querySelector<HTMLElement>('.comments-post-meta__name-text'),
    link.querySelector<HTMLElement>('.comments-comment-meta__description-title'),
    ...leafSpans,
    link.querySelector<HTMLElement>('span[dir="auto"]'),
    link.querySelector<HTMLElement>('span[aria-hidden="true"]'),
    link,
  ];
  for (const candidate of candidates) {
    const name = candidate?.textContent
      ?.replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*[•·]\s*(?:You|1st|2nd|3rd\+?)$/i, '')
      .trim();
    if (
      name &&
      name.length <= 120 &&
      /^\p{L}[\p{L}\p{M}'’.-]*(?:\s+\p{L}[\p{L}\p{M}'’.-]*){1,7}$/u.test(name) &&
      !/^(?:Current user|LinkedIn member|Author)$/i.test(name)
    ) {
      return name;
    }
  }
  return undefined;
}

function isInlineProfileMention(link: HTMLAnchorElement): boolean {
  const textBlock = link.closest<HTMLElement>(
    '[data-testid="comment-text"], [data-view-name="comment-text"], [dir="ltr"]',
  );
  if (!textBlock || textBlock === link) return false;
  const author = normalizeInlineText(profileLinkAuthor(link));
  const linkText = normalizeInlineText(link.textContent);
  const surroundingText = normalizeInlineText(textBlock.textContent);
  return author.length > 0 && linkText === author && surroundingText.length > linkText.length;
}

function profileAuthorsBeforeEditor(
  post: HTMLElement,
  composer: HTMLElement,
  editor: HTMLElement,
): HTMLAnchorElement[] {
  return Array.from(post.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]')).filter(
    (link) =>
      !composer.contains(link) &&
      precedes(link, editor) &&
      !isInlineProfileMention(link) &&
      Boolean(profileLinkAuthor(link)),
  );
}

function selectTargetAuthor(
  authors: HTMLAnchorElement[],
  editor: HTMLElement,
  composer: HTMLElement,
): HTMLAnchorElement | undefined {
  const mention = normalizeInlineText(`${editor.textContent ?? ''} ${composer.textContent ?? ''}`);
  const nearestFirst = [...authors].reverse();
  return (
    nearestFirst.find((link) => {
      const author = normalizeInlineText(profileLinkAuthor(link));
      return (
        mention.length > 0 &&
        author.length > 0 &&
        (mention.includes(author) || author.includes(mention))
      );
    }) ?? nearestFirst[0]
  );
}

function directText(element: HTMLElement): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanReplyCandidate(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  for (const selector of [
    `.${OWN_ELEMENT_CLASS}`,
    '.insightreply-reply-button',
    '.insightreply-reply-wrap',
    'a[href*="/in/"]',
    'button',
    '[role="button"]',
    'svg',
    'time',
    ...REPLY_EDITOR_SELECTORS,
  ]) {
    for (const child of clone.querySelectorAll<HTMLElement>(selector)) child.remove();
  }
  for (const block of clone.querySelectorAll<HTMLElement>('div, p, li, br')) {
    block.insertAdjacentText('beforebegin', ' ');
  }
  return (
    clone.textContent
      ?.replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:u?h?m{3,})[,.!…-]*\s*/i, '')
      .trim() ?? ''
  );
}

function isReplyMetadataText(text: string): boolean {
  return (
    /^(?:\.{3}|…)?\s*more$/i.test(text) ||
    /^\d+\s*(?:s|m|h|d|w|mo|y|yr)s?$/i.test(text) ||
    /^\d+(?:\s+(?:reaction|reactions|impression|impressions))?$/i.test(text) ||
    /^(?:Author|You|LinkedIn member)$/i.test(text)
  );
}

function extractTextBetween(
  root: HTMLElement,
  start: HTMLElement,
  end: HTMLElement,
): string | undefined {
  let best: { score: number; text: string } | undefined;
  const candidates = root.querySelectorAll<HTMLElement>(
    '[data-testid="comment-text"], [data-view-name="comment-text"], .comments-comment-item__main-content, .comments-comment-item-content-body, [dir="ltr"], div, p, span',
  );
  for (const candidate of candidates) {
    if (
      candidate === start ||
      candidate === end ||
      candidate.contains(start) ||
      candidate.contains(end) ||
      start.contains(candidate) ||
      end.contains(candidate) ||
      !precedes(start, candidate) ||
      !precedes(candidate, end) ||
      !isVisible(candidate)
    ) {
      continue;
    }

    const rawDirectText = directText(candidate);
    const knownTextContainer = candidate.matches(
      '[data-testid="comment-text"], [data-view-name="comment-text"], .comments-comment-item__main-content, .comments-comment-item-content-body, [dir="ltr"]',
    );
    if (!rawDirectText && !knownTextContainer) continue;

    const text = cleanReplyCandidate(candidate);
    if (!text || text.length > 4_000 || isReplyMetadataText(text)) continue;

    const className = typeof candidate.className === 'string' ? candidate.className : '';
    let score = 0;
    if (knownTextContainer) score += 50;
    if (rawDirectText) score += 35;
    if (/[.!?]/.test(text) || text.length >= 24) score += 25;
    if (/copy|content|body|commentary/i.test(className)) score += 20;
    if (/meta|subtitle|action|social|reaction/i.test(className)) score -= 100;
    if ((text.match(/\|/g)?.length ?? 0) >= 2) score -= 150;
    const profileLinkCount = candidate.querySelectorAll('a[href*="/in/"]').length;
    if (profileLinkCount === 1) score -= 50;
    if (profileLinkCount > 1) score -= 100;
    if (candidate.querySelector('button, [role="button"]') && text.length < 24) score -= 60;
    if (/\b(?:reaction|reactions|impression|impressions)\b/i.test(text)) score -= 100;
    score += Math.min(text.length, 200) / 200;

    if (!best || score > best.score) best = { score, text };
  }
  return best?.score !== undefined && best.score > 0 ? best.text : undefined;
}

function captureBoundedReplyContext(editor: HTMLElement, container: HTMLElement): void {
  const post = findPostContainers().find((candidate) => candidate.contains(editor));
  if (!post) return;
  const composer = findComposerScope(editor);
  const authors = profileAuthorsBeforeEditor(post, composer, editor);
  const authorsInsideContainer = authors.filter((author) => container.contains(author));
  if (container.matches(NATIVE_COMMENT_CONTAINER_SELECTOR) && authorsInsideContainer.length <= 1) {
    return;
  }
  const targetAuthor = selectTargetAuthor(authors, editor, composer);
  if (!targetAuthor) return;

  const text = extractTextBetween(post, targetAuthor, composer);
  if (!text) return;

  const targetIndex = authors.indexOf(targetAuthor);
  const previousAuthor = targetIndex > 0 ? authors[targetIndex - 1] : undefined;
  let threadScope = targetAuthor.parentElement;
  while (threadScope && threadScope !== post && !threadScope.contains(composer)) {
    threadScope = threadScope.parentElement;
  }
  const parentAuthor =
    previousAuthor && threadScope && threadScope !== post && threadScope.contains(previousAuthor)
      ? previousAuthor
      : undefined;
  const parentCommentText = parentAuthor
    ? extractTextBetween(post, parentAuthor, targetAuthor)
    : undefined;
  replyContextRegistry.set(container, {
    authorName: profileLinkAuthor(targetAuthor),
    text,
    parentCommentAuthorName: parentAuthor ? profileLinkAuthor(parentAuthor) : undefined,
    parentCommentText,
  });
}

/**
 * LinkedIn can render an open reply composer as a sibling of the incoming
 * reply. Resolve the target from the @mention in that composer and the nearest
 * preceding profile link instead of assuming the editor is inside its comment.
 */
function deriveCommentContainerFromEditor(editor: HTMLElement): HTMLElement | null {
  const post = findPostContainers().find((container) => container.contains(editor));
  if (!post) return null;
  const composer = findComposerScope(editor);
  const precedingAuthors = profileAuthorsBeforeEditor(post, composer, editor);
  const authorsNearestFirst = [...precedingAuthors].reverse();
  const targetAuthor = selectTargetAuthor(precedingAuthors, editor, composer);
  const mentionedAuthor =
    targetAuthor && targetAuthor !== authorsNearestFirst[0] ? targetAuthor : undefined;

  const known = editor.closest<HTMLElement>(NATIVE_COMMENT_CONTAINER_SELECTOR);
  if (known && !mentionedAuthor) return known;
  const resolvedTargetAuthor = targetAuthor ?? authorsNearestFirst[0];
  if (!resolvedTargetAuthor) return known;

  let common = resolvedTargetAuthor.parentElement;
  while (common && common !== post && !common.contains(editor)) common = common.parentElement;
  if (!common || common === post) {
    const targetKnown = resolvedTargetAuthor.closest<HTMLElement>(
      NATIVE_COMMENT_CONTAINER_SELECTOR,
    );
    return targetKnown ?? known;
  }

  const authorsInCommon = precedingAuthors.filter((link) => common.contains(link));
  if (authorsInCommon.length > 1) {
    const targetBranch = branchUnder(common, resolvedTargetAuthor);
    if (targetBranch) return targetBranch;
  }
  return common;
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
  for (const editor of root.querySelectorAll<HTMLElement>(REPLY_EDITOR_SELECTOR)) {
    if (!isEditable(editor) || !isVisible(editor)) continue;
    const container = deriveCommentContainerFromEditor(editor);
    if (!container) continue;
    container.setAttribute(DYNAMIC_COMMENT_ATTRIBUTE, 'true');
    editorTargetRegistry.set(editor, container);
    captureBoundedReplyContext(editor, container);
    if (!seen.has(container)) {
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
  return (
    Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
      (candidate) =>
        !candidate.classList.contains(OWN_ELEMENT_CLASS) &&
        belongsToComment(candidate, container) &&
        matchesReplyActionText(candidate.textContent) &&
        !isEditorElement(candidate) &&
        !looksLikeReplySubmit(candidate) &&
        isVisible(candidate),
    ) ?? null
  );
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
      const bounded = replyContextRegistry.get(container);
      if ((bounded?.text ?? extractCommentText(container)) !== locator.text) return false;
      if (
        locator.authorName &&
        (bounded?.authorName ?? extractCommentAuthor(container)) !== locator.authorName
      ) {
        return false;
      }
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
  return index > 0 ? (comments[index - 1] ?? null) : null;
}

function isNestedReply(container: HTMLElement): boolean {
  const parent = container.parentElement?.closest<HTMLElement>(COMMENT_CONTAINER_SELECTOR);
  return Boolean(parent && parent !== container);
}

function findOwnReplyWrap(container: HTMLElement): HTMLElement | null {
  const registered = replyWrapRegistry.get(container);
  if (registered?.isConnected) return registered;
  return (
    Array.from(container.querySelectorAll<HTMLElement>('.insightreply-reply-wrap')).find(
      (element) => belongsToComment(element, container),
    ) ?? null
  );
}

export function extractReplySelection(container: HTMLElement): SelectedPost | null {
  const activeEditor = findReplyEditor(container);
  if (activeEditor) captureBoundedReplyContext(activeEditor, container);
  const bounded = replyContextRegistry.get(container);
  const incomingText = bounded?.text ?? extractCommentText(container);
  if (!incomingText || incomingText.length > 4_000) return null;

  const postContainer = findPostContainers().find((post) => post.contains(container)) ?? null;
  if (!postContainer) return null;
  const post = extractPostData(postContainer).post;
  if (!post) return null;

  const incomingAuthor = bounded?.authorName ?? extractCommentAuthor(container);
  const parent = bounded ? null : findParentComment(container);
  const parentText =
    bounded?.parentCommentText ?? (parent ? extractCommentText(parent) : undefined);
  const parentAuthor =
    bounded?.parentCommentAuthorName ?? (parent ? extractCommentAuthor(parent) : undefined);
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
  const editor = findReplyEditor(container);
  if (!nested && !editor) {
    findOwnReplyWrap(container)?.remove();
    container.removeAttribute(REPLY_MOUNTED_ATTRIBUTE);
    return;
  }
  const replyAction = editor ? null : findReplyAction(container);
  if (!editor && !replyAction) {
    findOwnReplyWrap(container)?.remove();
    container.removeAttribute(REPLY_MOUNTED_ATTRIBUTE);
    return;
  }

  let wrap = findOwnReplyWrap(container);
  let button = wrap?.querySelector<HTMLButtonElement>('.insightreply-reply-button') ?? null;
  if (!wrap || !button) {
    button = createReplyButton();
    wrap = document.createElement('span');
    wrap.className = 'insightreply-reply-wrap';
    wrap.style.cssText = 'display:inline-flex;align-items:center;flex:none;';
    wrap.appendChild(button);
    replyWrapRegistry.set(container, wrap);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void handleReplyButtonClick(container, button!);
    });
  }

  if (editor) {
    const composer = findComposerScope(editor);
    const submit = Array.from(
      composer.querySelectorAll<HTMLElement>('button, [role="button"]'),
    ).find(
      (candidate) =>
        !candidate.classList.contains(OWN_ELEMENT_CLASS) &&
        isVisible(candidate) &&
        matchesReplyActionText(candidate.getAttribute('aria-label') ?? candidate.textContent),
    );
    if (submit) submit.insertAdjacentElement('beforebegin', wrap);
    else editor.insertAdjacentElement('afterend', wrap);
  } else {
    replyAction!.insertAdjacentElement('afterend', wrap);
  }
  container.setAttribute(REPLY_MOUNTED_ATTRIBUTE, 'true');
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
        (editorTargetRegistry.get(candidate) ??
          (belongsToComment(candidate, container) ? container : null)) === container &&
        isEditable(candidate) &&
        isVisible(candidate),
    );
    if (own) return own;
  }
  const siblingScope = container.parentElement;
  if (!siblingScope) return null;
  for (const selector of REPLY_EDITOR_SELECTORS) {
    const candidate = Array.from(siblingScope.querySelectorAll<HTMLElement>(selector)).find(
      (element) => {
        const mapped = editorTargetRegistry.get(element);
        if (mapped) return mapped === container && isEditable(element) && isVisible(element);
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
