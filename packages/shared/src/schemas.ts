import { z } from 'zod';

export const TONES = [
  'professional',
  'casual',
  'insightful',
  'supportive',
  'question_led',
  'respectful_contrarian',
] as const;

export const LENGTHS = ['short', 'medium', 'detailed'] as const;

export const EMOJI_PREFERENCES = ['none', 'occasional'] as const;

export const DEFAULT_SUGGESTION_COUNT = 3;
export const MIN_SUGGESTION_COUNT = 2;
export const MAX_SUGGESTION_COUNT = 4;

export const MAX_POST_LENGTH = 12_000;
export const MAX_PERSPECTIVE_LENGTH = 500;
export const MAX_WRITING_PROFILE_LENGTH = 1_500;
export const MAX_LANGUAGE_LENGTH = 30;
export const MAX_AUTHOR_NAME_LENGTH = 200;
export const MAX_POST_URL_LENGTH = 2048;
export const MAX_COMMENT_LENGTH = 4_000;
export const MAX_REPLY_TARGET_ID_LENGTH = 256;

const trimmedString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} exceeds the maximum length of ${max} characters`)
    .default('');

export const postSchema = z.object({
  authorName: trimmedString(MAX_AUTHOR_NAME_LENGTH, 'Author name').optional(),
  text: z
    .string()
    .trim()
    .min(1, 'Post text is required')
    .max(MAX_POST_LENGTH, `Post exceeds the maximum length of ${MAX_POST_LENGTH} characters`),
  url: trimmedString(MAX_POST_URL_LENGTH, 'Post URL').optional(),
});

export const preferencesSchema = z.object({
  tone: z.enum(TONES, { errorMap: () => ({ message: 'Invalid tone' }) }),
  length: z.enum(LENGTHS, { errorMap: () => ({ message: 'Invalid length' }) }),
  language: trimmedString(MAX_LANGUAGE_LENGTH, 'Language').optional(),
  emojiPreference: z.enum(EMOJI_PREFERENCES).optional(),
  customPerspective: trimmedString(MAX_PERSPECTIVE_LENGTH, 'Perspective').optional(),
  writingProfile: trimmedString(MAX_WRITING_PROFILE_LENGTH, 'Writing profile').optional(),
  suggestionCount: z
    .number()
    .int()
    .min(MIN_SUGGESTION_COUNT)
    .max(MAX_SUGGESTION_COUNT)
    .default(DEFAULT_SUGGESTION_COUNT),
});

export const replyGenerationContextSchema = z.object({
  authorName: trimmedString(MAX_AUTHOR_NAME_LENGTH, 'Reply author name').optional(),
  text: z
    .string()
    .trim()
    .min(1, 'Reply text is required')
    .max(MAX_COMMENT_LENGTH, `Reply exceeds the maximum length of ${MAX_COMMENT_LENGTH} characters`),
  parentCommentAuthorName: trimmedString(
    MAX_AUTHOR_NAME_LENGTH,
    'Parent comment author name',
  ).optional(),
  parentCommentText: trimmedString(MAX_COMMENT_LENGTH, 'Parent comment').optional(),
});

export const generateCommentsRequestSchema = z.object({
  post: postSchema,
  reply: replyGenerationContextSchema.optional(),
  preferences: preferencesSchema,
});


export const suggestionSchema = z.object({
  id: z.string().min(1).max(64),
  tone: z.string().min(1).max(64),
  text: z.string().min(1).max(2000),
});

export const generateCommentsResponseSchema = z.object({
  requestId: z.string().min(1).max(64),
  postSummary: z.string().min(1).max(300),
  suggestions: z.array(suggestionSchema).min(1).max(MAX_SUGGESTION_COUNT),
});


export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().optional(),
  }),
});


export const selectedReplyContextSchema = replyGenerationContextSchema.extend({
  targetId: z.string().min(1).max(MAX_REPLY_TARGET_ID_LENGTH),
});

export const selectedPostSchema = z.object({
  postId: z.string().min(1).max(256),
  authorName: z.string().max(MAX_AUTHOR_NAME_LENGTH).optional(),
  postText: z.string().min(1).max(MAX_POST_LENGTH),
  postUrl: z.string().max(MAX_POST_URL_LENGTH).optional(),
  truncated: z.boolean().optional().default(false),
  selectedAt: z.string().min(1),
  replyContext: selectedReplyContextSchema.optional(),
});


export const settingsSchema = z.object({
  defaultTone: z.enum(TONES),
  defaultLength: z.enum(LENGTHS),
  suggestionCount: z
    .number()
    .int()
    .min(MIN_SUGGESTION_COUNT)
    .max(MAX_SUGGESTION_COUNT)
    .default(DEFAULT_SUGGESTION_COUNT),
  emojiPreference: z.enum(EMOJI_PREFERENCES),
  writingProfile: z.string().max(MAX_WRITING_PROFILE_LENGTH).default(''),
  language: z.string().max(MAX_LANGUAGE_LENGTH).default('English'),
  backendUrl: z
    .string()
    .url('Backend URL must be a valid URL')
    .max(200)
    .default('http://localhost:8787'),
});
