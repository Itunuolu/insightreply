import type { SelectedPost, Settings } from '@insightreply/shared';
import { selectedPostSchema, settingsSchema } from '@insightreply/shared';
import { BUILD_DEFAULT_SETTINGS as DEFAULT_SETTINGS } from './config.js';

const SETTINGS_KEY = 'insightReplySettings';
const SELECTED_POST_KEY = 'insightReply.selectedPost';
const LEGACY_OFFICIAL_BACKEND_URLS = new Set(['https://insightreply-api.netlify.app']);

function migrateOfficialBackend(settings: Settings): Settings {
  const normalizedBackendUrl = settings.backendUrl.replace(/\/+$/, '');
  if (!LEGACY_OFFICIAL_BACKEND_URLS.has(normalizedBackendUrl)) return settings;
  return { ...settings, backendUrl: DEFAULT_SETTINGS.backendUrl };
}

/** Loads settings from chrome.storage.sync, falling back to defaults. */
export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    const value = stored[SETTINGS_KEY];
    if (value === undefined || value === null) return { ...DEFAULT_SETTINGS };
    const parsed = settingsSchema.safeParse(value);
    if (!parsed.success) return { ...DEFAULT_SETTINGS };
    const settings = migrateOfficialBackend(parsed.data);
    if (settings !== parsed.data) {
      try {
        await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
      } catch {
        // Keep the in-memory migration even when sync storage is temporarily unavailable.
      }
    }
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists settings to chrome.storage.sync (validated first). */
export async function saveSettings(settings: Settings): Promise<void> {
  const parsed = settingsSchema.safeParse(settings);
  if (!parsed.success) {
    throw new Error('Settings could not be saved: invalid values.');
  }
  await chrome.storage.sync.set({ [SETTINGS_KEY]: parsed.data });
}

/** Loads the currently selected post from short-lived session storage. */
export async function loadSelectedPost(): Promise<SelectedPost | null> {
  try {
    const stored = await chrome.storage.session.get(SELECTED_POST_KEY);
    const value = stored[SELECTED_POST_KEY];
    if (!value) return null;
    const parsed = selectedPostSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Clears the currently selected post (session storage only). */
export async function clearSelectedPost(): Promise<void> {
  try {
    await chrome.storage.session.remove(SELECTED_POST_KEY);
    await chrome.storage.session.remove('insightReply.selectedTabId');
  } catch {
    // nothing to clear
  }
}

/**
 * Subscribes to selected-post changes across panels (the content script may
 * select a new post while the panel is open). Returns an unsubscribe fn.
 */
export function watchSelectedPost(callback: (post: SelectedPost | null) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'session') return;
    const change = changes[SELECTED_POST_KEY];
    if (!change) return;
    const raw = change.newValue;
    if (raw === undefined || raw === null) {
      callback(null);
      return;
    }
    const parsed = selectedPostSchema.safeParse(raw);
    callback(parsed.success ? parsed.data : null);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
