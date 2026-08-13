import { z } from 'zod';
import { selectedPostSchema } from './schemas.js';
import type { RuntimeMessage } from './types.js';

const insertMessageSchema = z.object({
  type: z.literal('IR_INSERT_COMMENT'),
  postId: z.string().min(1).max(256),
  replyTargetId: z.string().min(1).max(256).optional(),
  text: z.string().min(1).max(2000),
  mode: z.enum(['replace', 'append', 'auto']),
});

const selectPostMessageSchema = z.object({
  type: z.literal('IR_SELECT_POST'),
  post: selectedPostSchema,
});

export type ParsedMessage =
  | { ok: true; message: RuntimeMessage }
  | { ok: false; code: string; message: string };

/**
 * Validates an untrusted runtime message. All extension contexts treat
 * incoming messages as untrusted even when they originate from another
 * extension context.
 */
export function parseMessage(raw: unknown): ParsedMessage {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'INVALID_MESSAGE', message: 'Invalid message payload.' };
  }

  const type = (raw as { type?: unknown }).type;

  if (type === 'IR_INSERT_COMMENT') {
    const parsed = insertMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, code: 'INVALID_MESSAGE', message: 'Invalid insert message.' };
    }
    return { ok: true, message: parsed.data };
  }

  if (type === 'IR_SELECT_POST') {
    const parsed = selectPostMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, code: 'INVALID_MESSAGE', message: 'Invalid post payload.' };
    }
    return { ok: true, message: parsed.data };
  }

  return { ok: false, code: 'UNSUPPORTED_MESSAGE', message: 'Unsupported message type.' };
}
