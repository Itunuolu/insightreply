/**
 * Builds the MV3 extension into dist-extension/:
 *   1. sidepanel.html + React bundle (Vite app build)
 *   2. content.js (IIFE bundle)
 *   3. service-worker.js (ES module bundle)
 *   4. manifest.json, icons and static files copied over
 * Supports --watch for development.
 */
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, mkdirSync, rmSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-extension');
const ICONS_SRC = join(ROOT, 'src', 'assets', 'icons');
const isWatch = process.argv.includes('--watch');

/**
 * Backend URL baked into the build as the out-of-the-box default.
 *
 * A published build must not ship `http://localhost:8787`: every user who
 * installs from the Web Store would get "backend could not be reached" until
 * they ran a Node server themselves. Set IR_DEFAULT_BACKEND_URL to your
 * deployed HTTPS backend when building the store package:
 *
 *   IR_DEFAULT_BACKEND_URL=https://api.example.com pnpm build:extension
 *
 * Users can still override it in Settings; this only sets the starting value.
 */
const DEFAULT_BACKEND_URL = process.env.IR_DEFAULT_BACKEND_URL?.trim() || 'http://localhost:8787';

try {
  const parsed = new URL(DEFAULT_BACKEND_URL);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('must be https:// unless it is localhost');
  }
} catch (err) {
  throw new Error(`IR_DEFAULT_BACKEND_URL is not a usable backend URL (${DEFAULT_BACKEND_URL}): ${err.message}`);
}

const define = {
  __IR_DEFAULT_BACKEND_URL__: JSON.stringify(DEFAULT_BACKEND_URL.replace(/\/+$/, '')),
};

function sidepanelConfig() {
  return {
    root: join(ROOT, 'src', 'sidepanel'),
    plugins: [react()],
    define,
    build: {
      outDir: OUT,
      emptyOutDir: false,
      rollupOptions: {
        input: join(ROOT, 'src', 'sidepanel', 'sidepanel.html'),
        output: {
          entryFileNames: 'sidepanel-[hash].js',
          chunkFileNames: 'chunk-[hash].js',
          assetFileNames: 'asset-[name]-[hash][extname]',
        },
      },
    },
  };
}

function scriptConfig(entry, outFile, format) {
  return {
    define,
    build: {
      outDir: OUT,
      emptyOutDir: false,
      lib: {
        entry: join(ROOT, 'src', entry),
        name: 'InsightReply',
        formats: [format],
        fileName: () => outFile,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  };
}

function copyStatic() {
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, 'manifest.json'), join(OUT, 'manifest.json'));
  if (!existsSync(ICONS_SRC)) {
    throw new Error('icons missing — run `pnpm icons` first (or `pnpm build`)');
  }
  cpSync(ICONS_SRC, join(OUT, 'icons'), { recursive: true });
}

async function runAll() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  console.log('▶ building side panel');
  await build(sidepanelConfig());
  console.log('▶ building content script');
  await build(scriptConfig('content/content.ts', 'content.js', 'iife'));
  console.log('▶ building service worker');
  await build(scriptConfig('background/service-worker.ts', 'service-worker.js', 'es'));
  copyStatic();
  console.log(`✓ extension built into ${OUT}`);
}

if (isWatch) {
  await runAll();
  watch(join(ROOT, 'src'), { recursive: true }, () => {
    console.log('change detected, rebuilding…');
    void runAll();
  });
  watch(join(ROOT, 'manifest.json'), () => {
    console.log('manifest changed, rebuilding…');
    void runAll();
  });
  console.log('watching for changes…');
} else {
  await runAll();
}
