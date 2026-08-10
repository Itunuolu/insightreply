/**
 * Rebuilds the Chrome Web Store listing images from committed source captures.
 *
 *   pnpm store:assets
 *
 * Inputs  — assets/store/raw/*.png (raw UI captures) and assets/brand/*.svg
 * Outputs — assets/store/screenshot-*.png (1280x800), promo tiles, store icon
 *
 * The raw captures are committed so the framed images can be regenerated after a
 * copy or branding change without re-running the extension. Refresh the raw
 * captures themselves only when the UI changes: load the extension against
 * assets/demo/demo-feed.html served from a linkedin.com URL and re-shoot them.
 *
 * Sizes follow the Developer Dashboard's stated requirements; confirm them there
 * before uploading, since Google adjusts them from time to time.
 */
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(EXT_ROOT, '..', '..');
const BRAND = join(REPO, 'assets', 'brand');
const STORE = join(REPO, 'assets', 'store');
const RAW = join(STORE, 'raw');

const mark = readFileSync(join(BRAND, 'insightreply-mark.svg'), 'utf8');
const markAt = (px) => mark.replace('width="64" height="64"', `width="${px}" height="${px}"`);
const shot = (name) =>
  `data:image/png;base64,${readFileSync(join(RAW, `${name}.png`)).toString('base64')}`;

const BASE = `
  * { box-sizing: border-box; margin: 0; }
  body {
    overflow: hidden; position: relative;
    background:
      radial-gradient(900px 520px at 78% -10%, #2b3d68 0%, transparent 62%),
      radial-gradient(620px 420px at 4% 104%, #3a2f12 0%, transparent 60%),
      linear-gradient(150deg, #0B1220 0%, #101a30 100%);
    font-family: Inter, 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #fff; -webkit-font-smoothing: antialiased;
  }
  .brand { position: absolute; top: 44px; left: 56px; display: flex; align-items: center; gap: 12px; }
  .brand .name { font-size: 19px; font-weight: 700; letter-spacing: -0.2px; }
  .brand .name span, h1 em { color: #E8C95E; }
  h1 em { font-style: normal; }
  .kicker {
    display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 1.7px;
    color: #E8C95E; border: 1px solid #E8C95E4d; border-radius: 999px; padding: 6px 14px;
  }
  h1 { font-size: 50px; line-height: 1.08; font-weight: 800; letter-spacing: -1.5px; }
  .sub { font-size: 20px; line-height: 1.5; color: #b6c2d6; font-weight: 450; }
  .shot { border-radius: 14px; border: 1px solid #ffffff1f; box-shadow: 0 40px 90px -20px #00000090; display: block; }
  .foot { position: absolute; bottom: 34px; left: 56px; font-size: 13px; color: #7d8ba3; }
`;

const brandBar = `
  <div class="brand">
    <div style="width:34px;height:34px">${markAt(34)}</div>
    <div class="name">Insight<span>Reply</span></div>
  </div>`;

/** Panel-led layout: copy left, tall side-panel capture right. */
const split = ({ kicker, title, sub, image, foot, width = 372 }) => `
<style>${BASE}
  .wrap { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr ${width + 120}px; align-items: center; }
  .copy { padding: 0 20px 0 56px; display: flex; flex-direction: column; gap: 22px; align-items: flex-start; }
  .stage { display: grid; place-items: center; height: 100%; }
</style>
${brandBar}
<div class="wrap">
  <div class="copy">
    <div class="kicker">${kicker}</div><h1>${title}</h1><div class="sub">${sub}</div>
  </div>
  <div class="stage"><img class="shot" src="${image}" style="width:${width}px"></div>
</div>
<div class="foot">${foot}</div>`;

/** Feed-led layout: copy left, wide feed capture bleeding off the right edge. */
const stacked = ({ kicker, title, sub, image, foot }) => `
<style>${BASE}
  h1 { font-size: 42px; letter-spacing: -1.2px; }
  .sub { font-size: 18px; }
  .copy { position: absolute; top: 132px; left: 56px; width: 420px; display: flex; flex-direction: column; gap: 20px; align-items: flex-start; }
  .stage { position: absolute; right: -74px; top: 104px; width: 716px; }
  .stage img { width: 716px; }
</style>
${brandBar}
<div class="copy">
  <div class="kicker">${kicker}</div><h1>${title}</h1><div class="sub">${sub}</div>
</div>
<div class="stage"><img class="shot" src="${image}"></div>
<div class="foot">${foot}</div>`;

const SCREENSHOTS = [
  ['screenshot-01-select', stacked({
    kicker: 'SELECTIVE BY DESIGN',
    title: 'One button.<br><em>Only the post you pick.</em>',
    sub: 'InsightReply never reads your feed. A small ✨ AI Comment button sits by each post — the post is captured only when you click it.',
    image: shot('feed-button'),
    foot: 'Nothing leaves the page until you press the button.',
  })],
  ['screenshot-02-compose', split({
    kicker: 'YOU SET THE ANGLE',
    title: 'Six tones.<br>Three lengths.',
    sub: 'Pick how you want to sound, then add the perspective you want the comment to take — your experience, your market, your question.',
    image: shot('panel-compose'),
    foot: 'Tone, length and perspective are sent with the post. Nothing else.',
  })],
  ['screenshot-03-suggestions', split({
    kicker: 'WRITTEN FOR THAT POST',
    title: 'Three drafts<br>worth editing.',
    sub: 'Each suggestion engages with the actual argument in the post. Edit any of them inline, regenerate one, or copy it out.',
    image: shot('panel-results'),
    foot: 'Generic praise and clichés are rejected before you ever see them.',
  })],
  ['screenshot-04-insert', stacked({
    kicker: 'ONE CLICK BACK',
    title: 'Insert it into<br><em>that post’s comment box.</em>',
    sub: 'InsightReply opens the comment editor for the same post and drops your chosen draft in as plain text. It never presses Post.',
    image: shot('feed-inserted'),
    foot: 'You review it and publish it yourself — always.',
  })],
  ['screenshot-05-privacy', split({
    kicker: 'YOUR KEYS, YOUR BACKEND',
    title: 'No database.<br>No scraping.',
    sub: 'Posts go to the backend you run, and on to the AI provider you configure. No profile crawling, no retention, no selling data.',
    image: shot('panel-settings'),
    foot: 'API keys stay server-side. The extension asks for four permissions.',
  })],
];

const PROMO_SMALL = `
<style>${BASE}
  .c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
</style>
<div class="c">
  <div style="width:66px;height:66px">${markAt(66)}</div>
  <div style="font-size:31px;font-weight:800;letter-spacing:-0.8px">Insight<span style="color:#E8C95E">Reply</span></div>
  <div style="font-size:14px;color:#b6c2d6;text-align:center;line-height:1.45;max-width:330px">
    Thoughtful LinkedIn comments,<br>on the post you choose
  </div>
</div>`;

const PROMO_MARQUEE = `
<style>${BASE}
  .c { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 620px; align-items: center; }
  .left { padding-left: 88px; display: flex; flex-direction: column; gap: 22px; align-items: flex-start; }
  .stage { display: grid; place-items: center; }
</style>
<div class="c">
  <div class="left">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="width:70px;height:70px">${markAt(70)}</div>
      <div style="font-size:44px;font-weight:800;letter-spacing:-1.2px">Insight<span style="color:#E8C95E">Reply</span></div>
    </div>
    <div style="font-size:37px;font-weight:700;line-height:1.18;letter-spacing:-0.9px;max-width:560px">
      Write comments worth<br>reading — in seconds.
    </div>
    <div style="font-size:19px;color:#b6c2d6;line-height:1.5;max-width:520px">
      Reads only the post you select. Suggests, never posts.
    </div>
    <div style="font-size:13px;color:#7d8ba3;letter-spacing:2px;font-weight:600;margin-top:6px">BY HADESH.AI</div>
  </div>
  <div class="stage"><img class="shot" src="${shot('panel-results')}" style="width:330px"></div>
</div>`;

mkdirSync(STORE, { recursive: true });
const browser = await chromium.launch();

const render = async (name, html, width, height) => {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html);
  await page.waitForTimeout(280);
  await page.screenshot({ path: join(STORE, `${name}.png`) });
  await page.close();
  console.log(`wrote assets/store/${name}.png (${width}x${height})`);
};

for (const [name, html] of SCREENSHOTS) await render(name, html, 1280, 800);
await render('promo-small-440x280', PROMO_SMALL, 440, 280);
await render('promo-marquee-1400x560', PROMO_MARQUEE, 1400, 560);
await browser.close();

copyFileSync(join(EXT_ROOT, 'src', 'assets', 'icons', 'icon128.png'), join(STORE, 'icon-128.png'));
console.log('wrote assets/store/icon-128.png (128x128)');
