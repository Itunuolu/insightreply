/* global chrome, document, getComputedStyle */
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = join(root, 'dist-extension');
const output = join(root, '..', '..', 'dist', 'visual-qa');
mkdirSync(output, { recursive: true });

const userDataDir = mkdtempSync(join(tmpdir(), 'insightreply-visual-qa-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

let worker;
for (let attempt = 0; attempt < 40 && !worker; attempt += 1) {
  worker = context.serviceWorkers()[0];
  if (!worker) await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!worker) throw new Error('Extension service worker did not start.');
const extensionId = new URL(worker.url()).host;

const selectedReply = {
  postId: 'urn:li:activity:reply_post_1',
  authorName: 'Ada Lovelace',
  postText:
    'Good product discovery changes what a team decides not to build. The most valuable signal is often hidden in the conversations beneath the post.',
  postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:reply_post_1',
  selectedAt: new Date().toISOString(),
  replyContext: {
    targetId: 'urn:li:comment:incoming_1',
    authorName: 'Grace Hopper',
    text: 'How do you separate a weak request from an unmet need when both can sound equally urgent?',
    parentCommentAuthorName: 'You',
    parentCommentText:
      'The strongest signal is often the feature customers never ask for twice.',
  },
};

async function auditPanel(page, state, width, height) {
  return page.evaluate(
    ({ label, viewportWidth, viewportHeight }) => {
      const elements = Array.from(document.querySelectorAll('*'));
      const overflow = elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.position !== 'fixed' && (rect.left < -1 || rect.right > viewportWidth + 1);
        })
        .slice(0, 12)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: String(element.className).slice(0, 100),
            text: (element.textContent ?? '').trim().slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          };
        });
      const suspiciousCodePoints = ['\u00e2', '\u00c2', '\u00f0', '\ufffd'];
      const controls = Array.from(
        document.querySelectorAll('button, input, textarea, select'),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute('aria-label') ??
            element.textContent?.trim() ??
            element.getAttribute('placeholder') ??
            element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });
      return {
        state: label,
        viewport: { width: viewportWidth, height: viewportHeight },
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        overflow,
        corruptText: suspiciousCodePoints.some((value) =>
          document.body.innerText.includes(value),
        ),
        controlsUnder24px: controls.filter(
          (control) => control.width < 24 || control.height < 24,
        ),
      };
    },
    { label: state, viewportWidth: width, viewportHeight: height },
  );
}

const audits = {};
const panel = await context.newPage();
await panel.setViewportSize({ width: 360, height: 800 });
await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
await panel.getByText('No conversation selected').waitFor();
await panel.screenshot({ path: join(output, '01-empty-360x800.png') });
audits.empty = await auditPanel(panel, 'empty', 360, 800);

await panel.evaluate(
  async (post) => chrome.storage.session.set({ 'insightReply.selectedPost': post }),
  selectedReply,
);
await panel.getByText('Reply conversation').waitFor();
await panel.screenshot({ path: join(output, '02-selected-reply-360x800.png') });
audits.selectedReply = await auditPanel(panel, 'selected-reply', 360, 800);

await panel.getByRole('button', { name: /Generate \d+ Replies/i }).click();
await panel
  .getByRole('button', { name: 'Insert reply' })
  .first()
  .waitFor({ timeout: 30_000 });
await panel.screenshot({ path: join(output, '03-generated-replies-top-360x800.png') });
const main = panel.locator('main');
await main.evaluate((element) => {
  element.scrollTop = element.scrollHeight;
});
await panel.waitForTimeout(250);
await panel.screenshot({ path: join(output, '04-generated-replies-bottom-360x800.png') });
audits.generatedReplies = await auditPanel(panel, 'generated-replies', 360, 800);

await panel.getByRole('button', { name: 'Settings', exact: true }).click();
await panel.getByText('Defaults').waitFor();
await main.evaluate((element) => {
  element.scrollTop = 0;
});
await panel.screenshot({ path: join(output, '05-settings-top-360x800.png') });
await main.evaluate((element) => {
  element.scrollTop = element.scrollHeight;
});
await panel.waitForTimeout(250);
await panel.screenshot({ path: join(output, '06-settings-bottom-360x800.png') });
audits.settings = await auditPanel(panel, 'settings', 360, 800);

await panel.setViewportSize({ width: 320, height: 720 });
await main.evaluate((element) => {
  element.scrollTop = 0;
});
await panel.screenshot({ path: join(output, '07-settings-narrow-320x720.png') });
audits.narrowSettings = await auditPanel(panel, 'settings-narrow', 320, 720);
await panel.getByRole('button', { name: 'Back to suggestions' }).first().click();
await panel.getByText('Reply conversation').waitFor();
await panel.screenshot({ path: join(output, '08-selected-reply-narrow-320x720.png') });
audits.narrowReply = await auditPanel(panel, 'selected-reply-narrow', 320, 720);

const linkedin = await context.newPage();
await linkedin.setViewportSize({ width: 1200, height: 900 });
await linkedin.addInitScript({
  content: `
    window.__irBridge = { messages: [] };
    window.chrome = {
      runtime: {
        id: 'test-extension-id',
        sendMessage: (message) => {
          window.__irBridge.messages.push(message);
          return Promise.resolve({ ok: true, opened: true });
        },
        onMessage: { addListener: () => {}, removeListener: () => {} }
      },
      storage: {
        session: { get: async () => ({}), set: async () => {}, remove: async () => {} },
        sync: { get: async () => ({}), set: async () => {}, remove: async () => {} },
        onChanged: { addListener: () => {}, removeListener: () => {} }
      }
    };
  `,
});
await linkedin.addInitScript({ path: join(extensionPath, 'content.js') });

const fixture = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f4f2ee; color: #191919; font-family: Arial, sans-serif; }
      .topbar { height: 54px; background: white; border-bottom: 1px solid #ddd; }
      .feed { width: 650px; margin: 28px auto; }
      .feed-shared-update-v2 { background: white; border: 1px solid #d9d9d9; border-radius: 10px; padding: 18px; }
      .actor { display: flex; gap: 10px; align-items: center; }
      .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #5d6d7e, #9aa6b2); }
      .update-components-actor__name { font-weight: 700; }
      .meta { font-size: 12px; color: #666; }
      .feed-shared-inline-show-more-text { font-size: 15px; line-height: 1.45; margin: 16px 0; }
      .feed-shared-social-actions { border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 8px 0; }
      .feed-shared-social-actions button, .modern-actions button { border: 0; background: none; color: #666; font-weight: 600; cursor: pointer; padding: 6px 8px; }
      .modern-comments { margin-top: 16px; }
      .modern-comment { position: relative; margin: 12px 0 0 34px; }
      .comment-bubble { background: #f2f2f2; border-radius: 0 10px 10px 10px; padding: 10px 12px; }
      .modern-author { font-weight: 700; font-size: 13px; }
      .modern-subtitle { color: #666; font-size: 12px; margin-top: 2px; }
      .modern-copy { font-size: 14px; line-height: 1.4; margin-top: 5px; }
      .modern-actions { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
      .modern-actions svg { width: 18px; height: 18px; border: 2px solid currentColor; border-radius: 6px; }
      .modern-composer { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
      .modern-editor { flex: 1; min-height: 44px; border: 1px solid #999; border-radius: 24px; padding: 11px 14px; background: white; }
      .modern-submit { border: 0; border-radius: 22px; background: #0a66c2; color: white; font-weight: 700; padding: 11px 18px; }
    </style>
  </head>
  <body>
    <div class="topbar"></div>
    <main class="feed">
      <div class="feed-shared-update-v2" data-urn="urn:li:activity:reply_post_1">
        <div class="actor"><div class="avatar"></div><div><span class="update-components-actor__name">Ada Lovelace</span><div class="meta">Founder - 2h</div></div></div>
        <div class="feed-shared-inline-show-more-text"><span class="update-components-text">Good product discovery changes what a team decides not to build.</span></div>
        <div class="feed-shared-social-actions"><button aria-label="Like">Like</button><button aria-label="Comment">Comment</button><button aria-label="Repost">Repost</button></div>
        <div class="modern-comments">
          <div class="modern-comment" data-comment-id="modern-user-comment">
            <div class="comment-bubble">
              <a href="/in/itunuoluwa"><span class="modern-author" dir="auto">Itunuoluwa Akinkugbe</span></a>
              <div class="modern-subtitle">Senior Business Analyst | Digital Transformation</div>
              <div class="modern-copy" dir="ltr">One subtle point worth adding: API awareness also improves user story quality because it pushes BAs to think in terms of events and contracts, not just features.</div>
            </div>
            <div class="modern-actions">
              <button aria-label="React to comment"><svg data-test-icon="thumbs-up-small"></svg></button>
              <button aria-label="Reply to Itunuoluwa Akinkugbe's comment"><svg data-test-icon="comment-small"></svg></button>
            </div>
            <div class="modern-composer" data-testid="ui-core-tiptap-text-editor-wrapper">
              <div class="modern-editor" contenteditable="true" role="textbox"><p>Itunuoluwa Akinkugbe</p></div>
              <button class="modern-submit" type="button">Reply</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>`;

await linkedin.goto(`data:text/html;charset=utf-8,${encodeURIComponent(fixture)}`);
await linkedin.locator('button.insightreply-reply-button').last().waitFor();
await linkedin.screenshot({
  path: join(output, '09-linkedin-reply-controls-1200x900.png'),
  fullPage: true,
});
audits.linkedin = await linkedin.evaluate(() => {
  const suspiciousCodePoints = ['\u00e2', '\u00c2', '\u00f0', '\ufffd'];
  const buttons = Array.from(
    document.querySelectorAll('button.insightreply-reply-button'),
  ).map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      text: element.textContent,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      color: style.color,
      border: style.border,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
    };
  });
  return {
    buttonCount: buttons.length,
    buttons,
    owners: Array.from(
      document.querySelectorAll('button.insightreply-reply-button'),
    ).map(
      (element) =>
        element.closest('[data-insightreply-comment-scope]')?.getAttribute('data-comment-id') ?? null,
    ),
    corruptText: suspiciousCodePoints.some((value) =>
      document.body.innerText.includes(value),
    ),
  };
});

const report = { extensionId, output, audits };
writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await context.close();
