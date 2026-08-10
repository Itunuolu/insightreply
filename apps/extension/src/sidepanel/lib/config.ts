import { DEFAULT_SETTINGS } from '@insightreply/shared';

/**
 * Backend URL baked in at build time via `IR_DEFAULT_BACKEND_URL`
 * (see apps/extension/scripts/build-extension.mjs). Falls back to the shared
 * default so unit tests and `vite dev` keep working without the define.
 */
declare const __IR_DEFAULT_BACKEND_URL__: string | undefined;

export const DEFAULT_BACKEND_URL: string =
  typeof __IR_DEFAULT_BACKEND_URL__ === 'string' && __IR_DEFAULT_BACKEND_URL__.length > 0
    ? __IR_DEFAULT_BACKEND_URL__
    : DEFAULT_SETTINGS.backendUrl;

/**
 * True when the build still points at a developer's own machine. A published
 * build must not: anyone installing from the Web Store would have no backend
 * to reach, so the panel surfaces a setup prompt instead of a network error.
 */
export function isLocalBackend(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/** Settings defaults for this build, with the build-time backend URL applied. */
export const BUILD_DEFAULT_SETTINGS = {
  ...DEFAULT_SETTINGS,
  backendUrl: DEFAULT_BACKEND_URL,
};
