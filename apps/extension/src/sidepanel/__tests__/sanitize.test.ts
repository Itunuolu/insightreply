import { describe, expect, it } from 'vitest';
import { escapeHtml, sanitizeText, truncateText } from '../lib/sanitize.js';

describe('sanitizeText', () => {
  it('strips control characters', () => {
    expect(sanitizeText('hello\u0000world\u0007!')).toBe('hello world !');
  });

  it('normalizes runs of whitespace', () => {
    expect(sanitizeText('  a\t\tb   c ')).toBe('a b c');
  });

  it('limits the length', () => {
    expect(sanitizeText('x'.repeat(600), 500)).toHaveLength(500);
  });

  it('keeps newlines', () => {
    expect(sanitizeText('line one\nline two')).toBe('line one\nline two');
  });
});

describe('truncateText', () => {
  it('keeps short text intact', () => {
    expect(truncateText('short', 100)).toBe('short');
  });

  it('truncates long text on a word boundary', () => {
    const result = truncateText('one two three four five six', 10);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(12);
  });
});

describe('escapeHtml', () => {
  it('escapes dangerous characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});
