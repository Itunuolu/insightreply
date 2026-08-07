import type { RuntimeMessage, RuntimeResponse } from '@insightreply/shared';
import { parseMessage } from '@insightreply/shared';
import { injectActionButton } from './linkedin/button.js';
import { findPostContainers, resolvePostContainer } from './linkedin/adapter.js';
import { insertComment, openCommentEditor, waitForCommentEditor } from './linkedin/insert.js';

let initialized = false;

/**
 * Scans for post containers and injects the AI Comment button into any that
 * do not already have one (mounted attribute guard prevents duplicates).
 */
export function scanAndInject(root: ParentNode = document): void {
  for (const container of findPostContainers(root)) {
    injectActionButton(container);
  }
}

let scanTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleScan(): void {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = undefined;
    scanAndInject();
  }, 400);
}

const FEED_FRAGMENT_MARKERS = [
  '.feed-shared-update-v2',
  '[data-urn^="urn:li:activity"]',
  '.scaffold-layout',
];

function mutationNeedsScan(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  return FEED_FRAGMENT_MARKERS.some(
    (marker) => el.matches(marker) || Boolean(el.querySelector?.(marker)),
  );
}

/**
 * MutationObserver-driven maintenance. Only injects buttons; it never reads
 * or transmits post content. Content is extracted only when the user clicks
 * the button.
 *
 * Attaches to <html> (not <body>) so the observer survives framework re-renders
 * and test harnesses that replace the body element.
 */
export function observeNewPosts(root: ParentNode = document): void {
  const target = root instanceof Document ? root.documentElement : root;
  if (!target) return;
  const observer = new MutationObserver((mutations) => {
    const needsScan = mutations.some((mutation) => {
      if (mutation.type !== 'childList') return false;
      return Array.from(mutation.addedNodes).some(mutationNeedsScan);
    });
    if (needsScan) scheduleScan();
  });

  observer.observe(target, { childList: true, subtree: true });
}

/** Handles insert requests forwarded by the service worker from the side panel. */
async function handleInsertRequest(
  message: Extract<RuntimeMessage, { type: 'IR_INSERT_COMMENT' }>,
): Promise<RuntimeResponse> {
  const container = resolvePostContainer(message.postId);
  if (!container) {
    return {
      ok: false,
      code: 'POST_NOT_FOUND',
      message: 'The original post is no longer on this page. Scroll to it and try again.',
    };
  }

  openCommentEditor(container);
  const editor = await waitForCommentEditor(container);
  if (!editor) {
    return {
      ok: false,
      code: 'COMMENT_EDITOR_NOT_FOUND',
      message: "Comment editor not found. Open the post's comment box and try again.",
    };
  }

  const result = insertComment(container, message.text, message.mode);
  if (!result.ok) {
    return result;
  }
  return { ok: true, inserted: true, hadExistingText: result.hadExistingText };
}

async function handleRuntimeMessage(raw: unknown): Promise<RuntimeResponse> {
  const parsed = parseMessage(raw);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code, message: parsed.message };
  }
  if (parsed.message.type === 'IR_INSERT_COMMENT') {
    return handleInsertRequest(parsed.message);
  }
  return { ok: false, code: 'UNSUPPORTED_MESSAGE', message: 'Unsupported message type.' };
}

export function initContentScript(): void {
  if (initialized) return;
  initialized = true;

  scanAndInject();
  observeNewPosts();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handleRuntimeMessage(message).then(sendResponse);
    return true; // keep the channel open for the async reply
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initContentScript(), { once: true });
  } else {
    initContentScript();
  }
}
