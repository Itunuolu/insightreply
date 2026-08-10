import { describe, expect, it } from 'vitest';
import { isLocalBackend, BUILD_DEFAULT_SETTINGS } from '../lib/config.js';

describe('backend build config', () => {
  it('recognises loopback hosts as local', () => {
    for (const url of ['http://localhost:8787', 'http://127.0.0.1:3000', 'http://localhost']) {
      expect(isLocalBackend(url)).toBe(true);
    }
  });

  it('does not treat a deployed URL as local', () => {
    for (const url of ['https://api.example.com', 'https://insightreply.fly.dev/v1']) {
      expect(isLocalBackend(url)).toBe(false);
    }
  });

  it('never throws on an unparseable URL', () => {
    expect(isLocalBackend('not a url')).toBe(false);
    expect(isLocalBackend('')).toBe(false);
  });

  it('exposes a usable default backend URL', () => {
    expect(() => new URL(BUILD_DEFAULT_SETTINGS.backendUrl)).not.toThrow();
  });
});
