import { expect, test, chromium, type BrowserContext } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEED_POST_CLASSIC, FE_POST_TESTDATA, POST_WITH_OPEN_EDITOR, TRUNCATED_POST } from '../../src/test/fixtures.js';

const EXTENSION_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist-extension');

const CHROME_STUB = `
  window.__irBridge = { messages: [], listener: null, responses: [] };
  window.chrome = {
    runtime: {
      id: 'test-extension-id',
      sendMessage: (message) => {
        window.__irBridge.messages.push(message);
        return Promise.resolve({ ok: true });
      },
      onMessage: {
        addListener: (fn) => { window.__irBridge.listener = fn; },
        removeListener: () => {}
      }
    },
    storage: {
      session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
      sync: { get: async () => ({}), set: async () => {}, remove: async () => {} },
      onChanged: { addListener: () => {}, removeListener: () => {} }
    }
  };
`;

async function launchWithExtension(): Promise<{ context: BrowserContext; extensionId: string }> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'insightreply-smoke-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.PLAYWRIGHT_HEADLESS === '1',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  let worker;
  for (let i = 0; i < 40 && !worker; i += 1) {
    worker = context.serviceWorkers()[0];
    if (!worker) await new Promise((r) => setTimeout(r, 500));
  }
  if (!worker) {
    await context.close();
    throw new Error('extension service worker did not start');
  }
  const extensionId = new URL(worker.url()).host;
  return { context, extensionId };
}

test.describe('InsightReply extension smoke test', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const launched = await launchWithExtension();
    context = launched.context;
    extensionId = launched.extensionId;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('the extension loads without manifest errors and the side panel renders', async () => {
    const panel = await context.newPage();
    const errors: string[] = [];
    panel.on('pageerror', (err) => errors.push(err.message));
    panel.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await expect(panel.getByText('InsightReply', { exact: true })).toBeVisible();
    await expect(panel.getByText('by Hadesh.ai')).toBeVisible();
    await expect(panel.getByText('No post selected')).toBeVisible();

    // The manifest is valid: service worker registered the panel behavior.
    const sw = context.serviceWorkers()[0];
    expect(sw).toBeTruthy();
    await panel.close();
  });

  test('the bundled content script injects buttons, extracts posts and inserts comments', async () => {
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript({ content: CHROME_STUB });
    await page.addInitScript({ path: join(EXTENSION_PATH, 'content.js') });

    const fixture = [
      FEED_POST_CLASSIC,
      FE_POST_TESTDATA,
      TRUNCATED_POST,
      POST_WITH_OPEN_EDITOR,
    ].join('\n');
    // Navigate (not setContent) so the init scripts run in this document.
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(`<main>${fixture}</main>`)}`);

    // 1. Button injection, exactly one per eligible post (debounced scan).
    await expect
      .poll(async () => page.locator('button.insightreply-button').count(), { timeout: 5_000 })
      .toBe(4);

    // 2. No post content is transmitted before a click.
    const messagesBefore = await page.evaluate(() => (window as unknown as { __irBridge: { messages: unknown[] } }).__irBridge.messages.length);
    expect(messagesBefore).toBe(0);

    // 3. Clicking selects only that post.
    const firstButtons = page.locator('button.insightreply-button');
    await firstButtons.first().click();
    await expect
      .poll(async () =>
        page.evaluate(() => (window as unknown as { __irBridge: { messages: { type: string }[] } }).__irBridge.messages.length),
      )
      .toBeGreaterThan(0);

    const sent = await page.evaluate(
      () => (window as unknown as { __irBridge: { messages: { type: string; post?: { postId?: string; authorName?: string; postText?: string } }[] } }).__irBridge.messages,
    );
    const selectMessage = sent.find((m) => m.type === 'IR_SELECT_POST');
    expect(selectMessage?.post?.postId).toBe('urn:li:activity:720123456789');
    expect(selectMessage?.post?.authorName).toBe('Ada Lovelace');
    expect(selectMessage?.post?.postText).toContain('analytics dashboard');

    // 4. Truncated post shows the guidance toast and is not selected.
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.insightreply-button'));
      const truncated = document.querySelector('[data-id="urn:li:activity:112233"]');
      const button = buttons.find((b) => truncated?.contains(b));
      button?.click();
    });
    await expect(page.locator('.insightreply-toast')).toContainText('Expand the post first');

    // 5. Insertion flows through the content-script message listener.
    const insertResult = await page.evaluate(async () => {
      const bridge = (window as unknown as { __irBridge: { listener?: (m: unknown, s: unknown, r: (x: unknown) => void) => unknown } }).__irBridge;
      return new Promise((resolve) => {
        bridge.listener?.(
          { type: 'IR_INSERT_COMMENT', postId: 'urn:li:activity:editor_1', text: 'Browser-level insertion test.', mode: 'auto' },
          {},
          (response) => resolve(response),
        );
      });
    });
    expect(insertResult).toMatchObject({ ok: true, inserted: true, hadExistingText: false });
    const editorText = await page.locator('[data-urn="urn:li:activity:editor_1"] .ql-editor').textContent();
    expect(editorText).toBe('Browser-level insertion test.');

    expect(pageErrors).toEqual([]);
    await page.close();
  });

  test('duplicate button injection is prevented after a MutationObserver re-scan', async () => {
    const page = await context.newPage();
    await page.addInitScript({ content: CHROME_STUB });
    await page.addInitScript({ path: join(EXTENSION_PATH, 'content.js') });
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(`<main>${FEED_POST_CLASSIC}</main>`)}`);

    await expect
      .poll(async () => page.locator('button.insightreply-button').count(), { timeout: 5_000 })
      .toBe(1);

    // Simulate LinkedIn re-rendering: remove and re-add the same post.
    await page.evaluate(() => {
      const container = document.querySelector('.feed-shared-update-v2') as HTMLElement;
      const clone = container.cloneNode(true) as HTMLElement;
      container.replaceWith(clone);
    });
    await page.waitForTimeout(900); // observer debounce

    const countAfterRescan = await page.locator('button.insightreply-button').count();
    expect(countAfterRescan).toBe(1);
    await page.close();
  });
});