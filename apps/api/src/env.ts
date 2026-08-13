import { z } from 'zod';

const numberFromEnv = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const booleanFromEnv = (name: string, fallback: boolean) => {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  return raw.trim().toLowerCase() === 'true' || raw.trim() === '1';
};

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required. See apps/api/.env.example.'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_TRANSPORT: z.enum(['responses', 'chat']).default('responses'),
  OPENAI_RESPONSE_FORMAT: z.enum(['json_schema', 'json_object']).default('json_schema'),
  OPENAI_THINKING_MODE: z.enum(['default', 'enabled', 'disabled']).default('default'),
  OPENAI_MODEL: z.string().min(1).default('gpt-5'),
  PORT: z.number().int().positive().max(65535).default(8787),
  ALLOWED_EXTENSION_ORIGIN: z.string().default(''),
  RATE_LIMIT_MAX: z.number().int().positive().default(30),
  RATE_LIMIT_WINDOW: z.number().int().positive().default(60_000),
  TRUST_PROXY: z.boolean().default(false),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

export interface Env {
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_TRANSPORT: 'responses' | 'chat';
  OPENAI_RESPONSE_FORMAT: 'json_schema' | 'json_object';
  OPENAI_THINKING_MODE: 'default' | 'enabled' | 'disabled';
  OPENAI_MODEL: string;
  PORT: number;
  ALLOWED_EXTENSION_ORIGIN: string;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW: number;
  TRUST_PROXY: boolean;
  LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

export function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TRANSPORT: process.env.OPENAI_TRANSPORT,
    OPENAI_RESPONSE_FORMAT: process.env.OPENAI_RESPONSE_FORMAT,
    OPENAI_THINKING_MODE: process.env.OPENAI_THINKING_MODE,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    PORT: numberFromEnv('PORT', 8787),
    ALLOWED_EXTENSION_ORIGIN: process.env.ALLOWED_EXTENSION_ORIGIN ?? '',
    RATE_LIMIT_MAX: numberFromEnv('RATE_LIMIT_MAX', 30),
    RATE_LIMIT_WINDOW: numberFromEnv('RATE_LIMIT_WINDOW', 60_000),
    TRUST_PROXY: booleanFromEnv('TRUST_PROXY', false),
    LOG_LEVEL: (process.env.LOG_LEVEL ?? 'info') as Env['LOG_LEVEL'],
  });

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data as Env;
}
