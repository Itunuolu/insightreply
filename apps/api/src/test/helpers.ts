import type { GenerateCommentsRequest } from '@insightreply/shared';
import type { Env } from '../env.js';
import type { OpenAiLikeClient } from '../ai/comment-generator.js';

export function makeTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    OPENAI_API_KEY: 'test-key',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_TRANSPORT: 'responses',
    OPENAI_MODEL: 'gpt-test',
    PORT: 8787,
    ALLOWED_EXTENSION_ORIGIN: '',
    RATE_LIMIT_MAX: 30,
    RATE_LIMIT_WINDOW: 60_000,
    TRUST_PROXY: false,
    LOG_LEVEL: 'warn',
    ...overrides,
  };
}

export function validRequest(): GenerateCommentsRequest {
  return {
    post: {
      authorName: 'Ada Lovelace',
      text: 'We just shipped a new analytics dashboard for our users. It took us a year of iteration and customer interviews to get here.',
      url: 'https://www.linkedin.com/posts/ada_1',
    },
    preferences: {
      tone: 'insightful',
      length: 'medium',
      suggestionCount: 3,
      emojiPreference: 'none',
    },
  };
}

export function validSuggestionsJson(count = 3): string {
  const texts = [
    'This is a genuinely distinct suggestion about product iteration that adds practical value.',
    'Customer interviews reveal that adoption spikes once the dashboard shows cohort breakdowns.',
    'A shorter weekly recap email turned churn around for our team in one quarter.',
    'The pricing page rewrite outperformed the previous copy by a wide margin in A/B tests.',
  ];
  const suggestions = Array.from({ length: count }, (_, i) => ({
    tone: 'insightful',
    text: texts[i % texts.length] ?? `Distinct suggestion number ${i + 1} with a practical observation.`,
  }));
  return JSON.stringify({ postSummary: 'A post about shipping an analytics dashboard.', suggestions });
}

export function makeFakeClient(
  handler: (params: Record<string, unknown>) => Promise<{
    output_text?: string;
    output?: unknown;
    refusal?: string | null;
  }>,
): OpenAiLikeClient {
  return {
    responses: {
      create: handler,
    },
  };
}
