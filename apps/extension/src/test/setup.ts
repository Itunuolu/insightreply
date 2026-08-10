import { beforeEach, vi } from 'vitest';

type AreaName = 'sync' | 'session' | 'local';

function createStorageArea(areaName: AreaName, initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    name: areaName,
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown>) => {
      if (keys === undefined) {
        return Object.fromEntries(store.entries());
      }
      if (typeof keys === 'string') {
        return { [keys]: store.get(keys) };
      }
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const key of keys) out[key] = store.get(key);
        return out;
      }
      const out: Record<string, unknown> = {};
      for (const [key, fallback] of Object.entries(keys)) {
        out[key] = store.has(key) ? store.get(key) : fallback;
      }
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) store.set(key, value);
      emitChanges(items, areaName, 'set');
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      const removed: Record<string, unknown> = {};
      for (const key of list) {
        if (store.has(key)) {
          removed[key] = store.get(key);
          store.delete(key);
        }
      }
      if (Object.keys(removed).length > 0) emitChanges(removed, areaName, 'remove');
    }),
    clear: vi.fn(async () => store.clear()),
  };
}

const changeListeners = new Set<
  (changes: Record<string, chrome.storage.StorageChange>, area: string) => void
>();
const messageListeners = new Set<
  (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => unknown
>();

function emitChanges(items: Record<string, unknown>, area: AreaName, op: 'set' | 'remove') {
  if (changeListeners.size === 0) return;
  const changes: Record<string, chrome.storage.StorageChange> = {};
  for (const [key, value] of Object.entries(items)) {
    changes[key] = op === 'set' ? { newValue: value } : { oldValue: value };
  }
  for (const listener of changeListeners) listener(changes, area);
}

const syncArea = createStorageArea('sync');
const sessionArea = createStorageArea('session');
const localArea = createStorageArea('local');

const chromeMock = {
  runtime: {
    id: 'beibbhgjopabhoilhpjmekecnbegpllc',
    lastError: undefined,
    sendMessage: vi.fn(async (message: unknown): Promise<unknown> => {
      let response: unknown = { ok: true };
      // Mirror extension messaging: listeners may return true and call
      // sendResponse asynchronously.
      const sendResponse = (r: unknown) => {
        response = r;
      };
      for (const listener of messageListeners) {
        void listener(message, { tab: { id: 1 } }, sendResponse);
      }
      return response;
    }),
    onMessage: {
      addListener: vi.fn((fn: unknown) => {
        if (typeof fn === 'function') {
          messageListeners.add(
            fn as (
              message: unknown,
              sender: unknown,
              sendResponse: (response: unknown) => void,
            ) => unknown,
          );
        }
      }),
      removeListener: vi.fn((fn: unknown) => {
        messageListeners.delete(fn as never);
      }),
    },
  },
  storage: {
    sync: syncArea,
    session: sessionArea,
    local: localArea,
    onChanged: {
      addListener: vi.fn((fn: unknown) => {
        if (typeof fn === 'function') {
          changeListeners.add(
            fn as (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
          );
        }
      }),
      removeListener: vi.fn((fn: unknown) => changeListeners.delete(fn as never)),
    },
  },
  sidePanel: {
    open: vi.fn(async () => ({})),
    setPanelBehavior: vi.fn(async () => ({})),
    setOptions: vi.fn(async () => ({})),
  },
  tabs: {
    sendMessage: vi.fn(async () => ({ ok: true, inserted: true, hadExistingText: false })),
  },
  scripting: {
    executeScript: vi.fn(async () => []),
  },
  action: {
    onClicked: { addListener: vi.fn() },
  },
  windows: {
    WINDOW_ID_CURRENT: -1,
  },
};

const ChromeMock = chromeMock as unknown as typeof chrome;
vi.stubGlobal('chrome', ChromeMock);

export const syncAreaAbove = syncArea;
export const sessionAreaAbove = sessionArea;

beforeEach(() => {
  messageListeners.clear();
  changeListeners.clear();
  void syncArea.clear();
  void sessionArea.clear();
  void localArea.clear();
  vi.clearAllMocks();
  vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true });
});
