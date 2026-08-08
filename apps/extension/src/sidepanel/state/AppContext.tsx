import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type {
  CommentLength,
  GenerateCommentsResponse,
  SelectedPost,
  Settings,
  Tone,
} from '@insightreply/shared';
import { settingsSchema } from '@insightreply/shared';
import { BUILD_DEFAULT_SETTINGS as DEFAULT_SETTINGS } from '../lib/config.js';
import {
  generateComments,
  regenerateSingleSuggestion,
  type PanelError,
} from '../lib/api.js';
import {
  clearSelectedPost as clearStoredPost,
  loadSelectedPost,
  loadSettings,
  saveSettings,
  watchSelectedPost,
} from '../lib/storage.js';

export type View = 'generate' | 'settings';

export interface Compose {
  tone: Tone;
  length: CommentLength;
  perspective: string;
}

export interface CommentDraft {
  id: string;
  tone: string;
  text: string;
}

export interface ConfirmRequest {
  text: string;
  onResolve: (mode: 'replace' | 'append') => void;
  onCancel: () => void;
}

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface AppState {
  view: View;
  settings: Settings;
  selectedPost: SelectedPost | null;
  compose: Compose;
  /** Set once the user picks a tone/length by hand, so saved defaults stop seeding it. */
  composeTouched: boolean;
  generationStatus: 'idle' | 'generating' | 'error';
  generationError: PanelError | null;
  result: GenerateCommentsResponse | null;
  drafts: CommentDraft[];
  toasts: ToastMessage[];
  confirm: ConfirmRequest | null;
}

type Action =
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'SET_SELECTED_POST'; post: SelectedPost | null }
  | { type: 'SET_COMPOSE'; compose: Partial<Compose> }
  | { type: 'GENERATION_START' }
  | { type: 'GENERATION_DONE'; result: GenerateCommentsResponse; drafts: CommentDraft[] }
  | { type: 'GENERATION_ERROR'; error: PanelError }
  | { type: 'SET_DRAFT'; id: string; text: string }
  | { type: 'REPLACE_DRAFT'; id: string; text: string }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'PUSH_TOAST'; toast: ToastMessage }
  | { type: 'DISMISS_TOAST'; id: number }
  | { type: 'SHOW_CONFIRM'; confirm: ConfirmRequest }
  | { type: 'HIDE_CONFIRM' };

function buildDrafts(result: GenerateCommentsResponse): CommentDraft[] {
  return result.suggestions.map((s) => ({ id: s.id, tone: s.tone, text: s.text }));
}

function initialState(settings: Settings): AppState {
  return {
    view: 'generate',
    settings,
    selectedPost: null,
    compose: {
      tone: settings.defaultTone,
      length: settings.defaultLength,
      perspective: '',
    },
    composeTouched: false,
    generationStatus: 'idle',
    generationError: null,
    result: null,
    drafts: [],
    toasts: [],
    confirm: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_SETTINGS':
      // Saved defaults must actually seed the composer. Without this the panel
      // always generated with the hard-coded DEFAULT_SETTINGS tone/length no
      // matter what the user configured. A hand-picked choice still wins.
      return {
        ...state,
        settings: action.settings,
        compose: state.composeTouched
          ? state.compose
          : {
              ...state.compose,
              tone: action.settings.defaultTone,
              length: action.settings.defaultLength,
            },
      };
    case 'SET_SELECTED_POST':
      return {
        ...state,
        selectedPost: action.post,
        generationStatus: 'idle',
        generationError: null,
      };
    case 'SET_COMPOSE':
      return {
        ...state,
        compose: { ...state.compose, ...action.compose },
        composeTouched:
          state.composeTouched ||
          action.compose.tone !== undefined ||
          action.compose.length !== undefined,
      };
    case 'GENERATION_START':
      return { ...state, generationStatus: 'generating', generationError: null };
    case 'GENERATION_DONE':
      return {
        ...state,
        generationStatus: 'idle',
        generationError: null,
        result: action.result,
        drafts: action.drafts,
      };
    case 'GENERATION_ERROR':
      return { ...state, generationStatus: 'error', generationError: action.error };
    case 'SET_DRAFT':
      return {
        ...state,
        drafts: state.drafts.map((d) =>
          d.id === action.id ? { ...d, text: action.text } : d,
        ),
      };
    case 'REPLACE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.map((d) =>
          d.id === action.id ? { ...d, text: action.text } : d,
        ),
      };
    case 'CLEAR_RESULTS':
      return { ...state, result: null, drafts: [], generationStatus: 'idle' };
    case 'PUSH_TOAST':
      return {
        ...state,
        toasts: [...state.toasts.filter((t) => t.id !== action.toast.id), action.toast],
      };
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'SHOW_CONFIRM':
      return { ...state, confirm: action.confirm };
    case 'HIDE_CONFIRM':
      return { ...state, confirm: null };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  setView: (view: View) => void;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  setSelectedPost: (post: SelectedPost | null) => void;
  clearSelectedPost: () => Promise<void>;
  patchCompose: (patch: Partial<Compose>) => void;
  runGeneration: () => Promise<void>;
  setDraftText: (id: string, text: string) => void;
  regenerateDraft: (id: string) => Promise<void>;
  copyDraft: (id: string) => Promise<void>;
  insertDraft: (id: string) => Promise<void>;
  showToast: (text: string, kind?: ToastMessage['kind']) => void;
  dismissToast: (id: number) => void;
  requestConfirm: (text: string, onResolve: (mode: 'replace' | 'append') => void) => void;
  confirmResolve: (mode: 'replace' | 'append') => void;
  confirmCancel: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastSeq = 1;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_SETTINGS, initialState);

  useEffect(() => {
    let disposed = false;
    void loadSettings().then((settings) => {
      if (!disposed) dispatch({ type: 'SET_SETTINGS', settings });
    });
    void loadSelectedPost().then((post) => {
      if (!disposed) dispatch({ type: 'SET_SELECTED_POST', post });
    });
    const unsubscribe = watchSelectedPost((post) => {
      dispatch({ type: 'SET_SELECTED_POST', post });
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const setView = useCallback((view: View) => dispatch({ type: 'SET_VIEW', view }), []);
  const patchCompose = useCallback(
    (patch: Partial<Compose>) => dispatch({ type: 'SET_COMPOSE', compose: patch }),
    [],
  );

  const showToast = useCallback(
    (text: string, kind: ToastMessage['kind'] = 'info') => {
      const toast: ToastMessage = { id: toastSeq++, kind, text };
      dispatch({ type: 'PUSH_TOAST', toast });
      window.setTimeout(() => dispatch({ type: 'DISMISS_TOAST', id: toast.id }), 4000);
    },
    [],
  );

  const patchSettings = useCallback(
    async (patch: Partial<Settings>) => {
      // Merge onto the *current* settings, not the defaults: patching a single
      // field must not reset every other field the user has configured.
      const merged = { ...DEFAULT_SETTINGS, ...state.settings, ...patch };
      const parsed = settingsSchema.safeParse(merged);
      if (!parsed.success) {
        throw new Error('Invalid settings. Check the values and try again.');
      }
      dispatch({ type: 'SET_SETTINGS', settings: parsed.data });
      await saveSettings(parsed.data);
    },
    [state.settings],
  );

  const resetSettings = useCallback(async () => {
    await saveSettings(DEFAULT_SETTINGS);
    dispatch({ type: 'SET_SETTINGS', settings: DEFAULT_SETTINGS });
  }, []);

  const clearSelectedPost = useCallback(async () => {
    await clearStoredPost();
    dispatch({ type: 'SET_SELECTED_POST', post: null });
  }, []);

  const setDraftText = useCallback(
    (id: string, text: string) => dispatch({ type: 'SET_DRAFT', id, text }),
    [],
  );

  const runGeneration = useCallback(async () => {
    const post = state.selectedPost ?? (await loadSelectedPost());
    if (!post) {
      showToast('Select a post on LinkedIn first.', 'error');
      return;
    }
    if (post.truncated) {
      showToast('Expand the post first so InsightReply can analyse the complete text.', 'error');
      return;
    }

    dispatch({ type: 'GENERATION_START' });
    try {
      const result = await generateComments({ settings: state.settings, post, compose: state.compose });
      dispatch({ type: 'GENERATION_DONE', result, drafts: buildDrafts(result) });
    } catch (err) {
      const error = asPanelError(err);
      dispatch({ type: 'GENERATION_ERROR', error });
      showToast(error.message, 'error');
    }
  }, [state.selectedPost, state.settings, state.compose, showToast]);

  const regenerateDraft = useCallback(
    async (id: string) => {
      const draft = state.drafts.find((d) => d.id === id);
      if (!draft) return;
      const post = state.selectedPost ?? (await loadSelectedPost());
      if (!post) {
        showToast('Select a post on LinkedIn first.', 'error');
        return;
      }
      showToast('Regenerating this suggestion…');
      try {
        const fresh = await regenerateSingleSuggestion({
          settings: state.settings,
          post,
          compose: state.compose,
          currentTexts: state.drafts
            .filter((d) => d.id !== id)
            .map((d) => d.text),
        });
        if (fresh) {
          dispatch({ type: 'REPLACE_DRAFT', id, text: fresh.text });
          showToast('Replaced with a fresh suggestion.');
        }
      } catch (err) {
        showToast(asPanelError(err).message, 'error');
      }
    },
    [state.drafts, state.selectedPost, state.settings, state.compose, showToast],
  );

  const copyDraft = useCallback(
    async (id: string) => {
      const draft = state.drafts.find((d) => d.id === id);
      if (!draft || !draft.text.trim()) return;
      try {
        await navigator.clipboard.writeText(draft.text);
        showToast('Copied');
      } catch {
        showToast('Could not copy. Select the text and copy it manually.', 'error');
      }
    },
    [state.drafts, showToast],
  );

  const confirmResolve = useCallback(
    (mode: 'replace' | 'append') => {
      const current = state.confirm;
      dispatch({ type: 'HIDE_CONFIRM' });
      current?.onResolve(mode);
    },
    [state.confirm],
  );

  const confirmCancel = useCallback(() => dispatch({ type: 'HIDE_CONFIRM' }), []);

  const requestConfirm = useCallback(
    (text: string, onResolve: (mode: 'replace' | 'append') => void) => {
      dispatch({ type: 'SHOW_CONFIRM', confirm: { text, onResolve, onCancel: confirmCancel } });
    },
    [confirmCancel],
  );

  const insertDraft = useCallback(
    async (id: string) => {
      const draft = state.drafts.find((d) => d.id === id);
      if (!draft || !draft.text.trim()) return;
      const post = state.selectedPost ?? (await loadSelectedPost());
      if (!post) {
        showToast('Select a post on LinkedIn first.', 'error');
        return;
      }

      const sendInsert = async (mode: 'replace' | 'append' | 'auto') => {
        const response: unknown = await chrome.runtime.sendMessage({
          type: 'IR_INSERT_COMMENT',
          postId: post.postId,
          text: draft.text,
          mode,
        });
        return response as
          | { ok: true; inserted: boolean; hadExistingText: boolean }
          | { ok: false; code: string; message: string };
      };

      try {
        const response = await sendInsert('auto');
        if (!response.ok) {
          showToast(response.message, 'error');
          return;
        }
        if (response.hadExistingText) {
          requestConfirm(
            'The comment box already contains text. Replace it or append the suggestion?',
            async (mode) => {
              const retry = await sendInsert(mode);
              if (!retry.ok) {
                showToast(retry.message, 'error');
                return;
              }
              showToast('Inserted — review it on LinkedIn before posting.');
            },
          );
          return;
        }
        showToast('Inserted — review it on LinkedIn before posting.');
      } catch {
        showToast('Could not insert the comment. Open LinkedIn and try again.', 'error');
      }
    },
    [state.drafts, state.selectedPost, showToast, requestConfirm],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      setView,
      patchSettings,
      resetSettings,
      setSelectedPost: (post) => dispatch({ type: 'SET_SELECTED_POST', post }),
      clearSelectedPost,
      patchCompose,
      runGeneration,
      setDraftText,
      regenerateDraft,
      copyDraft,
      insertDraft,
      showToast,
      dismissToast: (id) => dispatch({ type: 'DISMISS_TOAST', id }),
      requestConfirm,
      confirmResolve,
      confirmCancel,
    }),
    [
      state,
      setView,
      patchSettings,
      resetSettings,
      clearSelectedPost,
      patchCompose,
      runGeneration,
      setDraftText,
      regenerateDraft,
      copyDraft,
      insertDraft,
      showToast,
      requestConfirm,
      confirmResolve,
      confirmCancel,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

function asPanelError(err: unknown): PanelError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as PanelError;
  }
  return { code: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' };
}

export type { CommentLength, GenerateCommentsResponse, SelectedPost, Settings, Tone };
