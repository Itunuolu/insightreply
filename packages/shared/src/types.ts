import type { z } from 'zod';
import type {
  EMOJI_PREFERENCES,
  LENGTHS,
  TONES,
  generateCommentsRequestSchema,
  generateCommentsResponseSchema,
  selectedPostSchema,
  settingsSchema,
} from './schemas.js';

export type Tone = (typeof TONES)[number];
export type CommentLength = (typeof LENGTHS)[number];
export type EmojiPreference = (typeof EMOJI_PREFERENCES)[number];

export type GenerateCommentsRequest = z.infer<typeof generateCommentsRequestSchema>;
export type GenerateCommentsResponse = z.infer<typeof generateCommentsResponseSchema>;
export type SelectedPost = z.infer<typeof selectedPostSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export type ToneLabel = Record<Tone, string>;

export const TONE_LABELS: ToneLabel = {
  professional: 'Professional',
  casual: 'Casual',
  insightful: 'Insightful',
  supportive: 'Supportive',
  question_led: 'Question-led',
  respectful_contrarian: 'Contrarian but respectful',
};

export const LENGTH_LABELS: Record<CommentLength, { label: string; description: string }> = {
  short: { label: 'Short', description: 'Approximately 15–30 words' },
  medium: { label: 'Medium', description: 'Approximately 30–60 words' },
  detailed: { label: 'Detailed', description: 'Approximately 60–100 words' },
};

export const DEFAULT_SETTINGS: Settings = {
  defaultTone: 'insightful',
  defaultLength: 'medium',
  suggestionCount: 3,
  emojiPreference: 'none',
  writingProfile: '',
  language: 'English',
  backendUrl: 'http://localhost:8787',
};

/** Runtime message protocol shared between content script, side panel and service worker. */
export type RuntimeMessage =
  | {
      type: 'IR_SELECT_POST';
      post: SelectedPost;
    }
  | {
      type: 'IR_INSERT_COMMENT';
      postId: string;
      text: string;
      mode: 'replace' | 'append' | 'auto';
    }
  | {
      type: 'IR_SELECT_POST_FAILED';
      code: string;
    };

export type RuntimeResponse =
  | { ok: true; inserted: boolean; hadExistingText: boolean }
  | { ok: false; code: string; message: string };

export interface InsertionRequest {
  postId: string;
  text: string;
}
