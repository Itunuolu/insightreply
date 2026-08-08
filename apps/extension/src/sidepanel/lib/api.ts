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

function buildRequest(params: GenerateParams) {
  const { settings, post, compose } = params;
  return {
    post: {
      authorName: post.authorName,
      text: post.postText,
      url: post.postUrl,
    },
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
    throw panelError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((i) => i.message).join(' '),
    );
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
  let response: Response;
  try {
    response = await fetch(`${normalizeBackendUrl(url)}/v1/comments/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw panelError('NETWORK_ERROR', 'The AI took too long to respond. Please try again.');
    }
    // Name the URL that failed: the most common cause is a build still pointing
    // at a backend on the developer's own machine, which no other user can reach.
    const target = normalizeBackendUrl(url);
    throw panelError(
      'NETWORK_ERROR',
      isLocalBackend(target)
        ? `Could not reach ${target}. That backend runs on this machine — start it, or set a deployed backend URL in Settings.`
        : `Could not reach ${target}. Check the backend URL in Settings and that the server is running.`,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw panelError(parsed.data.error.code, parsed.data.error.message);
    }
    throw panelError('BACKEND_ERROR', 'The backend returned an unexpected response. Please try again.');
  }

  return body;
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
export async function regenerateSingleSuggestion(params: GenerateParams & {
  currentTexts: string[];
}): Promise<GenerateCommentsResponse['suggestions'][number] | null> {
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
    (candidate) => !params.currentTexts.some((existing) => similarity(existing, candidate.text) > 0.6),
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
