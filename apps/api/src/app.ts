import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import OpenAI from 'openai';
import { CommentGenerator, type OpenAiLikeClient } from './ai/comment-generator.js';
import type { Env } from './env.js';
import { registerErrorHandler } from './lib/errors.js';
import { createLogger } from './lib/logger.js';
import { registerCommentRoutes } from './routes/comments.js';
import { registerHealthRoutes } from './routes/health.js';

export interface BuildAppDeps {
  env: Env;
  /** Injectable for tests; defaults to a real OpenAI SDK client. */
  client?: OpenAiLikeClient;
  /**
   * Fastify logger options (instance, config object, or boolean).
   * Defaults to a pino config based on LOG_LEVEL; disabled under NODE_ENV=test
   * unless explicitly provided.
   */
  logger?: FastifyServerOptions['logger'];
}

export function createOpenAiClient(
  apiKey: string,
  baseURL = 'https://api.openai.com/v1',
  transport: 'responses' | 'chat' = 'responses',
  responseFormat: 'json_schema' | 'json_object' = 'json_schema',
): OpenAiLikeClient {
  const client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 1 });

  if (transport === 'chat') {
    return {
      responses: {
        async create(params: Record<string, unknown>): Promise<{
          output_text?: string;
          output?: unknown;
          refusal?: string | null;
        }> {
          const format = params.text as
            | { format?: { type?: string; name?: string; schema?: Record<string, unknown>; strict?: boolean } }
            | undefined;
          const jsonFormat = format?.format;
          const localFormat =
            responseFormat === 'json_schema' && jsonFormat?.type === 'json_schema' && jsonFormat.name && jsonFormat.schema
              ? {
                  type: 'json_schema' as const,
                  json_schema: {
                    name: jsonFormat.name,
                    schema: jsonFormat.schema,
                    strict: jsonFormat.strict ?? true,
                  },
                }
              : responseFormat === 'json_object'
                ? ({ type: 'json_object' } as const)
                : undefined;

          const completion = await client.chat.completions.create(
            {
              model: params.model as string,
              temperature: params.temperature as number | undefined,
              messages: [
                { role: 'system', content: (params.instructions as string) ?? '' },
                {
                  role: 'user',
                  content:
                    localFormat?.type === 'json_object' && jsonFormat?.schema
                      ? `${(params.input as string) ?? ''}\n\nOutput JSON matching exactly this schema (no prose, no markdown):\n${JSON.stringify(jsonFormat.schema)}`
                      : ((params.input as string) ?? ''),
                },
              ],
              ...(localFormat ? { response_format: localFormat } : {}),
            },
            { timeout: params.timeout as number | undefined },
          );

          const message = completion.choices?.[0]?.message;
          return {
            output_text: message?.content ?? undefined,
            refusal: message?.refusal ?? null,
          };
        },
      },
    };
  }

  return client as OpenAiLikeClient;
}

export async function buildApp(deps: BuildAppDeps): Promise<FastifyInstance> {
  const { env } = deps;
  const loggerOption: FastifyServerOptions['logger'] =
    deps.logger ?? (process.env.NODE_ENV === 'test' ? false : createLogger(env.LOG_LEVEL));

  const app = Fastify({
    logger: loggerOption,
    bodyLimit: 32_768,
    trustProxy: env.TRUST_PROXY,
  });

  registerErrorHandler(app);

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true); // curl / non-browser clients
      const allowed = env.ALLOWED_EXTENSION_ORIGIN;
      if (allowed && origin === allowed) return callback(null, true);
      return callback(new Error('Origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type'],
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => {
      if (request.ip === '127.0.0.1' || request.ip === '::1') {
        // Give local development a stable key that still differentiates sessions.
        return `local_${(request.headers['user-agent'] ?? 'unknown').toString().slice(0, 64)}`;
      }
      return request.ip;
    },
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Wait a moment and try again.',
        retryAfterMs: context.after,
      },
    }),
  });

  const client =
  deps.client ??
  createOpenAiClient(
    env.OPENAI_API_KEY,
    env.OPENAI_BASE_URL,
    env.OPENAI_TRANSPORT,
    env.OPENAI_RESPONSE_FORMAT,
  );
  const generator = new CommentGenerator({ client, model: env.OPENAI_MODEL });

  await registerHealthRoutes(app);
  await registerCommentRoutes(app, {
    generator,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitWindow: env.RATE_LIMIT_WINDOW,
  });

  return app;
}
