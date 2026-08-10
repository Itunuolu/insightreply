import type { RuntimeMessage, RuntimeResponse, SelectedPost } from '@insightreply/shared';
import { parseMessage, selectedPostSchema, settingsSchema } from '@insightreply/shared';

const SESSION_KEYS = {
  selectedPost: 'insightReply.selectedPost',
  selectedTabId: 'insightReply.selectedTabId',
} as const;

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

function openPanel(tabId?: number): Promise<void> {
  if (typeof chrome.sidePanel?.open !== 'function') {
    return Promise.resolve();
  }
  if (typeof tabId === 'number') {
    return chrome.sidePanel.open({ tabId });
  }
  return chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
}

/** Stores the selected post (short-lived session state) and opens the panel. */
async function handleSelectPost(
  post: SelectedPost,
  sender: chrome.runtime.MessageSender,
): Promise<{ ok: true; opened: boolean }> {
  const parsed = selectedPostSchema.safeParse(post);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(' '));
  }

  await chrome.storage.session.set({
    [SESSION_KEYS.selectedPost]: parsed.data,
    [SESSION_KEYS.selectedTabId]: sender.tab?.id ?? null,
  });

  // Opening the panel is best-effort: Chrome rejects sidePanel.open() outside a
  // user gesture, and that raw API string used to surface as the user-facing
  // toast even though the selection itself had already been stored.
  try {
    await openPanel(sender.tab?.id);
    return { ok: true, opened: true };
  } catch {
    return { ok: true, opened: false };
  }
}

/** Relays an insert request from the side panel to the tab that owns the post. */
async function handleInsertComment(
  message: Extract<RuntimeMessage, { type: 'IR_INSERT_COMMENT' }>,
): Promise<RuntimeResponse> {
  const selected = await chrome.storage.session.get(SESSION_KEYS.selectedTabId);
  const selectedTabId = selected[SESSION_KEYS.selectedTabId];
  if (typeof selectedTabId !== 'number') {
    return {
      ok: false,
      code: 'NO_SELECTED_TAB',
      message: 'No post selected. Select a post on LinkedIn first.',
    };
  }

  const attempt = async (): Promise<RuntimeResponse> => {
    const response = (await chrome.tabs.sendMessage(selectedTabId, message)) as
      | RuntimeResponse
      | undefined;
    if (response && typeof response === 'object' && 'ok' in response) {
      return response;
    }
    return {
      ok: false,
      code: 'NO_RESPONSE',
      message: 'The LinkedIn page did not respond. Reload the page and select the post again.',
    };
  };

  try {
    return await attempt();
  } catch {
    // Content script may not be loaded yet (fresh navigation). Inject and retry.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: selectedTabId },
        files: ['content.js'],
      });
      return await attempt();
    } catch {
      return {
        ok: false,
        code: 'NO_RESPONSE',
        message: 'Could not reach the LinkedIn page. Reload it, select the post again, and retry.',
      };
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse: (response: unknown) => void) => {
    void (async () => {
      const parsed = parseMessage(message);
      if (!parsed.ok) {
        sendResponse({ ok: false, code: parsed.code, message: parsed.message });
        return;
      }

      try {
        if (parsed.message.type === 'IR_SELECT_POST') {
          const result = await handleSelectPost(parsed.message.post, sender);
          sendResponse({ ok: true, opened: result.opened });
          return;
        }
        if (parsed.message.type === 'IR_INSERT_COMMENT') {
          const result = await handleInsertComment(parsed.message);
          sendResponse(result);
          return;
        }
        sendResponse({ ok: false, code: 'UNSUPPORTED_MESSAGE', message: 'Unsupported message type.' });
      } catch (err) {
        sendResponse({
          ok: false,
          code: 'BACKEND_FAILURE',
          message: err instanceof Error ? err.message : 'The request could not be completed.',
        });
      }
    })();
    return true; // keep the channel open for the async reply
  },
);

// Defense in depth: settings written to sync storage are validated here too,
// since storage is shared mutable state. Invalid values are dropped.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  const next = changes.insightReplySettings?.newValue;
  if (next === undefined || next === null) return;
  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) {
    void chrome.storage.sync.remove('insightReplySettings');
  }
});