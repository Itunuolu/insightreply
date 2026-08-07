/**
 * Sanitization helpers for the side panel. React escapes rendered text, but
 * we still scrub control characters and normalize whitespace for anything
 * that came from an untrusted source (LinkedIn post content, AI output).
 */

/**
 * Replaces control characters (except newline) with a space and
 * trims/normalizes whitespace. Control characters become a space so words
 * do not concatenate after scrubbing.
 */
export function sanitizeText(value: string, maxLength = 500): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  const normalized = cleaned.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  return normalized.slice(0, maxLength);
}

/** Truncates text to `max` characters preserving whole words. */
export function truncateText(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

/** Escapes text intended for URL or attribute placement (defense in depth). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
