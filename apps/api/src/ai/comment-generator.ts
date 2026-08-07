import type { GenerateCommentsRequest } from '@insightreply/shared';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { buildPrompt } from './prompt.js';
import { filterSuggestions } from './quality.js';

const aiSuggestionSchema = z.object({
  tone: z.string().min(1).max(64),
  text: z.string().min(1).max(2000),
});

const aiResponseSchema = z.object({
  postSummary: z.string().min(1).max(300),
  suggestions: z.array(aiSuggestionSchema).min(1).max(4),
});

export interface SuggestionItem {
  tone: string;
  text: string;
}

export interface OpenAiLikeClient {
  responses: {
    create(
      params: Record<string, unknown>,
    ): Promise<{ output_text?: string; output?: unknown; refusal?: string | null }>;
  };
  timeouts?: { request: number };
}

export interface GeneratorResult {
  requestId: string;
  postSummary: string;
  suggestions: SuggestionItem[];
  repaired: boolean;
}

export interface CommentGeneratorDeps {
  client: OpenAiLikeClient;
  model: string;
  timeoutMs?: number;
}

const uuidSafe = (): string => {
  try {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 24)
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

export class CommentGenerator {
  private readonly client: OpenAiLikeClient;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(deps: CommentGeneratorDeps) {
    this.client = deps.client;
    this.model = deps.model;
    this.timeoutMs = deps.timeoutMs ?? 60_000;
  }

  async generate(request: GenerateCommentsRequest): Promise<GeneratorResult> {
    const prompt = buildPrompt(request);
    const requestId = `req_${uuidSafe()}`;

    const first = await this.callModel(request, prompt, requestId);
    if (first.parsed) {
      return first.value;
    }

    const repairPayload = buildPrompt({
      ...request,
      preferences: {
        ...request.preferences,
        customPerspective: request.preferences.customPerspective
          ? `${request.preferences.customPerspective} Output must be valid JSON exactly matching the requested schema.`
          : 'Output must be valid JSON exactly matching the requested schema.',
      },
    });
    const second = await this.callModel(request, repairPayload, requestId);
    if (!second.parsed) {
      throw new ApiError(
        422,
        'AI_INVALID_OUTPUT',
        'OpenAI returned an invalid or unparseable structured response',
        'The AI returned an unreadable response. Please try again.',
      );
    }

    return { ...second.value, repaired: true };
  }

  private async callModel(
    request: GenerateCommentsRequest,
    prompt: ReturnType<typeof buildPrompt>,
    requestId: string,
  ): Promise<{ parsed: boolean; value: GeneratorResult }> {
    let parsedBody: Awaited<ReturnType<OpenAiLikeClient['responses']['create']>>;
    try {
      parsedBody = await this.client.responses.create({
        model: this.model,
        instructions: prompt.instructions,
        input: prompt.input,
        text: {
          format: {
            type: 'json_schema',
            name: 'insightreply_comments',
            strict: true,
            schema: prompt.jsonSchema,
          },
        },
        temperature: 0.9,
        timeout: this.timeoutMs,
      });
    } catch (err) {
      throw this.mapOpenAiError(err, requestId);
    }

    if (parsedBody.refusal) {
      throw new ApiError(
        422,
        'AI_REFUSED',
        'OpenAI refused to generate a comment for this request',
        'The model declined this request. Try a different perspective or post.',
      );
    }

    const text = parsedBody.output_text ?? this.joinOutputText(parsedBody.output);
    if (!text?.trim()) {
      throw new ApiError(
        422,
        'AI_INVALID_OUTPUT',
        'OpenAI returned an empty structured response',
        'AI returned an empty response. Please try again.',
      );
    }

    const parsed = this.parseAndValidate(text, request.preferences.suggestionCount);
    if (!parsed) {
      return {
        parsed: false,
        value: { requestId, postSummary: '', suggestions: [], repaired: false },
      };
    }

    const filtered = filterSuggestions(parsed.suggestions, request.post.text, {
      length: request.preferences.length,
      emojiPreference: request.preferences.emojiPreference,
      maxQuestionModeTone:
        request.preferences.tone === 'question_led' ? 'question_led' : 'none',
      allowHashtags: false,
    });

    if (filtered.length === 0) {
      throw new ApiError(
        422,
        'GENERATION_REJECTED',
        'All generated suggestions failed quality checks or were too similar to the post',
        'The AI suggested only generic or unoriginal comments. Try a different tone or perspective and regenerate.',
      );
    }

    // Trim back to the requested count (which will already de-duplicate).
    const suggestions = filtered.slice(0, request.preferences.suggestionCount).map((s, i) => ({
      ...s,
      id: `sug_${i + 1}_${requestId.slice(0, 6)}`,
    }));

    const value: GeneratorResult = {
      requestId,
      postSummary: parsed.postSummary,
      suggestions,
      repaired: false,
    };
    return { parsed: true, value };
  }

  private parseAndValidate(
    text: string,
    suggestionCount: number,
  ): { postSummary: string; suggestions: SuggestionItem[] } | null {
    let json: unknown = null;
    const trimmed = text.trim();
    const match = trimmed.match(/^[\s\S]*?({[\s\S]*?})\s*$/);
    const candidate = match ? match[1]! : trimmed;
    try {
      json = JSON.parse(candidate);
    } catch {
      return null;
    }
    const result = aiResponseSchema.safeParse(json);
    if (!result.success) return null;
    if (result.data.suggestions.length < suggestionCount) return null;
    return {
      postSummary: result.data.postSummary,
      suggestions: result.data.suggestions,
    };
  }

  private joinOutputText(output?: unknown): string {
    if (!Array.isArray(output)) return '';
    return output
      .filter((part): part is Record<string, unknown> => !!part && typeof part === 'object')
      .map((part) => {
        const text = part.text;
        return typeof text === 'string' ? text : '';
      })
      .join('');
  }

  private mapOpenAiError(err: unknown, requestId: string): Error {
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        return new ApiError(
          429,
          'RATE_LIMITED',
          `OpenAI rate limit reached (request ${requestId})`,
          'Too many requests right now. Wait a moment and try again.',
        );
      }
      if (status === 401 || status === 403) {
        return new ApiError(
          502,
          'AI_UPSTREAM_ERROR',
          `OpenAI authentication error (request ${requestId})`,
          'The AI provider rejected the request key. Check the backend configuration.',
        );
      }
      if (typeof err === 'object' && 'code' in err) {
        const code = (err as { code?: unknown }).code;
        if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
          return new ApiError(
            502,
            'AI_TIMEOUT',
            `OpenAI request timed out (request ${requestId})`,
            'The AI took too long to respond. Please try again.',
          );
        }
      }
    }
    return new ApiError(
      502,
      'AI_UPSTREAM_ERROR',
      `OpenAI request failed (request ${requestId})`,
      'The AI provider could not be reached. Please try again in a moment.',
      err instanceof Error ? err : undefined,
    );
  }
}