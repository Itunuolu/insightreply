import type {
  CommentLength,
  GenerateCommentsResponse,
  SelectedPost,
  Settings,
  Tone,
} from '@insightreply/shared';
import {
  apiErrorSchema,
  generateCommentsRequestSchema,
  generateCommentsResponseSchema,
} from '@insightreply/shared';
import { isLocalBackend } from './config.js';

export interface PanelError {
  code: string;
  message: string;
}

interface GenerateParams {
  settings: Settings;
  post: SelectedPost;
  compose: {
    tone: Tone;
    length: CommentLength;
    perspective: string;
  };
}

export const WEB_STORE_EXTENSION_ID = 'beibbhgjopabhoilhpjmekecnbegpllc';

const RETRYABLE_STATUS_CODES = new Set([408, 425, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [350, 1_000] as const;

function buildRequest(params: GenerateParams) {
  const { settings, post, compose } = params;
  return {
    post: {
      authorName: post.authorName,
      text: post.postText,
      url: post.postUrl,
    },
    reply: post.replyContext
      ? {
          authorName: post.replyContext.authorName,
          text: post.replyContext.text,
          parentCommentAuthorName: post.replyContext.parentCommentAuthorName,
          parentCommentText: post.replyContext.parentCommentText,
        }
      : undefined,
    preferences: {
      tone: compose.tone,
      length: compose.length,
      language: settings.language || undefined,
      emojiPreference: settings.emojiPreference,
      customPerspective: compose.perspective.trim() || undefined,
      writingProfile: settings.writingProfile.trim() || undefined,
      suggestionCount: settings.suggestionCount,
    },
  };
}

/** Validates the outgoing payload with the shared schema before sending. */
function validateRequest(params: GenerateParams) {
  const payload = buildRequest(params);
  const parsed = generateCommentsRequestSchema.safeParse(payload);
  if (!parsed.success) {
    throw panelError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(' '));
  }
  return parsed.data;
}

/**
 * Trims trailing slashes from the configured backend URL. Pasting
 * "http://localhost:8787/" is valid per the settings schema but would otherwise
 * produce "…//v1/comments/generate", which the backend answers with a 404.
 */
export function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function requestBackend(url: string, payload: unknown): Promise<unknown> {
  const target = normalizeBackendUrl(url);
  const maxAttempts = isLocalBackend(target) ? 1 : RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${target}/v1/comments/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw panelError(
          'NETWORK_TIMEOUT',
          'The AI service took too long to respond. Your request was not completed; please retry.',
        );
      }
      if (attempt + 1 < maxAttempts) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw unreachableBackendError(target, maxAttempts);
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt + 1 < maxAttempts) {
        await waitBeforeRetry(attempt);
        continue;
      }
      const parsed = apiErrorSchema.safeParse(body);
      if (parsed.success) {
        throw panelError(parsed.data.error.code, parsed.data.error.message);
      }
      throw panelError(
        'BACKEND_ERROR',
        `The backend returned HTTP ${response.status}. Please retry in a moment.`,
      );
    }

    return body;
  }

  throw unreachableBackendError(target, maxAttempts);
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1) ?? 1_000;
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay));
}

function unreachableBackendError(target: string, attempts: number): PanelError {
  if (isLocalBackend(target)) {
    return panelError(
      'NETWORK_ERROR',
      `Could not reach ${target}. That backend runs on this machine — start it, or use the deployed backend URL in Settings.`,
    );
  }

  const runtimeId = globalThis.chrome?.runtime?.id;
  if (runtimeId && runtimeId !== WEB_STORE_EXTENSION_ID) {
    return panelError(
      'EXTENSION_ID_MISMATCH',
      `This is an unpacked or duplicate InsightReply copy (ID ${runtimeId}). Disable it in edge://extensions and use the Web Store copy (ID ${WEB_STORE_EXTENSION_ID}).`,
    );
  }

  return panelError(
    'NETWORK_ERROR',
    `Could not reach ${target} after ${attempts} attempts. Check your internet connection and retry; InsightReply will automatically recover from brief service interruptions.`,
  );
}

function validateResponse(raw: unknown): GenerateCommentsResponse {
  const parsed = generateCommentsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw panelError(
      'INVALID_AI_OUTPUT',
      'The backend returned an unreadable response. Please try again.',
    );
  }
  return parsed.data;
}

/** Generates comments via the configured backend. */
export async function generateComments(params: GenerateParams): Promise<GenerateCommentsResponse> {
  const payload = validateRequest(params);
  const body = await requestBackend(params.settings.backendUrl, payload);
  return validateResponse(body);
}

/** Regenerates a single suggestion, requesting one fresh candidate. */
export async function regenerateSingleSuggestion(
  params: GenerateParams & {
    currentTexts: string[];
  },
): Promise<GenerateCommentsResponse['suggestions'][number] | null> {
  const payload = validateRequest({
    ...params,
    settings: { ...params.settings, suggestionCount: 2 },
  });
  const body = await requestBackend(params.settings.backendUrl, payload);
  const response = validateResponse(body);
  const [first] = response.suggestions;
  if (!first) return null;

  // Prefer a candidate that is not nearly identical to the other drafts.
  const best = response.suggestions.find(
    (candidate) =>
      !params.currentTexts.some((existing) => similarity(existing, candidate.text) > 0.6),
  );
  return best ?? first;
}

function similarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function panelError(code: string, message: string): PanelError {
  return { code, message };
}
