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

function sidepanelConfig() {
  return {
    root: join(ROOT, 'src', 'sidepanel'),
    plugins: [react()],
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
