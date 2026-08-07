import type { SelectedPost } from '@insightreply/shared';
import {
  extractPostData,
  findEngagementBar,
  isMounted,
  markMounted,
} from './adapter.js';

const BUTTON_TEXT = '✨ AI Comment';

/**
 * Injects a small "AI Comment" button near a post's engagement controls.
 * Idempotent per post container (guarded by the mounted attribute).
 */
export function injectActionButton(container: HTMLElement): void {
  if (isMounted(container)) return;

  const anchor = findEngagementBar(container);
  const button = createActionButton();

  if (anchor) {
    const row = document.createElement('div');
    row.className = 'insightreply-row';
    row.style.cssText =
      'display:flex;justify-content:flex-end;padding:8px 16px;margin-top:-4px;';
    row.appendChild(button);
    anchor.parentElement?.insertBefore(row, anchor.nextSibling);
  } else {
    const wrapper = container.querySelector('div');
    if (wrapper) {
      wrapper.appendChild(button);
    } else {
      container.appendChild(button);
    }
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handleButtonClick(container, button);
  });

  markMounted(container);
}

function createActionButton(): HTMLButtonElement {
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = BUTTON_TEXT;
  button.className = 'insightreply-button';
  button.setAttribute('aria-label', 'Generate AI comment suggestions with InsightReply');
  button.style.cssText = [
    'all:unset',
    'display:inline-flex',
    'align-items:center',
    'gap:6px',
    'padding:6px 12px',
    'margin:0',
    'border-radius:20px',
    'background:#0b1220',
    'border:1px solid #d4af37',
    'color:#e8c95e',
    'font:600 12px/1.2 Inter,system-ui,sans-serif',
    'cursor:pointer',
    'transition:background 120ms ease',
  ].join(';');
  button.addEventListener('mouseover', () => {
    button.style.background = '#1a2540';
  });
  button.addEventListener('mouseout', () => {
    button.style.background = '#0b1220';
  });
  return button;
}

/**
 * Extracts the selected post (user-initiated only), stores it through the
 * service worker and opens the side panel. Never runs in the background.
 */
export async function handleButtonClick(
  container: HTMLElement,
  button: HTMLElement,
): Promise<void> {
  const result = extractPostData(container);
  if (!result.post) {
    const message = userMessageForError(result.error ?? 'no_container');
    showToast(message);
    void notifyBackgroundOfSelectionFailure(result.error ?? 'no_container');
    return;
  }

  button.setAttribute('disabled', 'true');
  try {
    await dispatchSelection(result.post);
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Could not open the side panel. Click the extension icon instead.';
    showToast(message);
  } finally {
    button.removeAttribute('disabled');
  }
}

function userMessageForError(code: string): string {
  switch (code) {
    case 'truncated':
      return 'Expand the post first so InsightReply can analyse the complete text.';
    case 'unsupported_post_type':
      return 'InsightReply works with text posts. This post type is not supported yet.';
    case 'no_post_text':
      return 'InsightReply could not read this post. Try a different post.';
    default:
      return 'InsightReply could not identify this post. Try another post.';
  }
}

async function notifyBackgroundOfSelectionFailure(code: string): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'IR_SELECT_POST_FAILED', code });
  } catch {
    // best effort — the toast already explained the problem
  }
}

/** Tells the service worker a post was selected; it stores it and opens the panel. */
async function dispatchSelection(post: SelectedPost): Promise<void> {
  const response: unknown = await chrome.runtime.sendMessage({ type: 'IR_SELECT_POST', post });
  if (
    response &&
    typeof response === 'object' &&
    'ok' in response &&
    (response as { ok?: boolean }).ok === false
  ) {
    throw new Error((response as { message?: string }).message ?? 'Selection could not be stored.');
  }
}

export function showToast(message: string): void {
  document.querySelector('.insightreply-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'insightreply-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'max-width:320px',
    'padding:10px 16px',
    'background:#111a2e',
    'border:1px solid #d4af37',
    'border-radius:10px',
    'color:#f5f5f5',
    'font:500 13px/1.4 Inter,system-ui,sans-serif',
    'box-shadow:0 8px 24px rgba(0,0,0,.35)',
    'z-index:2147483647',
  ].join(';');
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 6000);
}

function ensureStyles(): void {
  if (document.getElementById('insightreply-style')) return;
  const style = document.createElement('style');
  style.id = 'insightreply-style';
  style.textContent = `
    .insightreply-button:hover { opacity:.92; }
    .insightreply-button:focus-visible {
      outline:2px solid #e8c95e;
      outline-offset:2px;
    }
  `;
  document.head.appendChild(style);
}
