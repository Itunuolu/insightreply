# Chrome Web Store Preparation Checklist

Work through this list before submitting InsightReply for review.

## 1. Pre-submission checks

- [ ] `pnpm install` succeeds on a clean clone
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (shared, api, extension unit tests)
- [ ] `pnpm build` passes and `apps/extension/dist-extension/` contains no source maps leaking `.ts` sources
- [ ] `pnpm package:extension` produces `dist/insightreply-extension.zip`
- [ ] **Security sweep:** `grep -ri "sk-" apps/extension/dist-extension` returns nothing; the zip contains no `.env`, no API keys, no `node_modules`
- [ ] Load the unpacked build in a clean Chrome profile and verify:
  - [ ] No manifest errors on `chrome://extensions`
  - [ ] `✨ AI Comment` button appears on feed posts
  - [ ] `✨ AI Reply` appears beside Reply actions in expanded comment threads
  - [ ] Side panel opens from the toolbar icon and from the button
  - [ ] Generate → 3 suggestions → edit → copy → insert → manual review → manual post
  - [ ] Truncated post shows the expand-first notice
  - [ ] Replace/Append/Cancel flow works with pre-filled editor text
  - [ ] A reply suggestion inserts into the selected reply editor, never a sibling thread

## 1b. Backend readiness (do this BEFORE uploading)

The extension is useless without a reachable backend, and a reviewer cannot run
`pnpm dev`. Work through this in order:

- [ ] Deploy `apps/api` somewhere with HTTPS (Railway, Render, Fly.io, a VPS) and confirm `GET /health`
- [ ] Build the store package against that URL — the default is baked in at build time:
      ```bash
      IR_DEFAULT_BACKEND_URL=https://your-backend.example.com pnpm build:extension && pnpm package:extension
      ```
      The build refuses any non-HTTPS URL other than localhost, so a dev default cannot ship by accident.
- [ ] Confirm the zip's default is right: users who never open Settings must still be able to generate

### The extension id changes when you publish

The unpacked build's id and the published id are different, and the published one
does not exist until after your first upload. Sequence:

- [ ] Upload the zip as a **draft** — do not submit yet
- [ ] Copy the extension id the dashboard assigns
- [ ] Add it to the backend's `ALLOWED_EXTENSION_ORIGIN`, which is comma-separated so dev keeps working:
      `ALLOWED_EXTENSION_ORIGIN=chrome-extension://<dev-id>,chrome-extension://<published-id>`
- [ ] Redeploy the backend and confirm the preflight passes:
      ```bash
      curl -i -X OPTIONS https://your-backend.example.com/v1/comments/generate \
        -H "Origin: chrome-extension://<published-id>" -H "Access-Control-Request-Method: POST"
      ```
      A correct response echoes `access-control-allow-origin` for that origin. If it is missing, every
      request from the published extension will fail — the server logs a warning naming the rejected origin.
- [ ] Only then submit for review

## 2. Store listing content

- [ ] **Name:** InsightReply — AI Comment & Reply Assistant (confirm the dashboard's current character limit)
- [ ] **Short description** (≤ 132 chars) e.g. *"Write thoughtful LinkedIn comments and replies from conversations you choose — you review and post everything yourself."*
- [ ] **Detailed description** (≤ 16,000 chars): what it does, how it works, user control emphasis, privacy summary, link to the privacy policy
- [ ] **Screenshots** (1280×800, up to 5) — ready to upload in order from `assets/store/`:
  1. `screenshot-01-select.png` — the button on a post
  2. `screenshot-02-compose.png` — tone, length, perspective
  3. `screenshot-03-suggestions.png` — three generated drafts
  4. `screenshot-04-insert.png` — inserted into the comment box
  5. `screenshot-05-privacy.png` — settings, backend and privacy
- [ ] **Small promo tile** (440×280): `assets/store/promo-small-440x280.png`
- [ ] **Marquee promo tile** (1400×560, only needed if you apply for homepage featuring): `assets/store/promo-marquee-1400x560.png`
- [ ] **Store icon** (128×128): `assets/store/icon-128.png`
- [ ] Confirm the required sizes in the Developer Dashboard before uploading — Google changes them
      occasionally, and the dashboard is the authority
- [ ] Regenerate any of the above with `pnpm store:assets` after a UI change
- [ ] **Category:** Productivity; **Language:** en
- [ ] **Homepage URL:** your product page (optional but recommended)

## 3. Privacy practice

- [ ] Publish `docs/privacy-policy.md` at a stable URL and submit it in the Developer Dashboard
- [ ] **Single purpose:** "generate draft comments and replies for LinkedIn conversations selected by the user"
- [ ] **Data usage table** in the dashboard:
  - [ ] *Conversation content the user selects (post and, when applicable, reply context)* → transmitted solely to generate suggestions → not stored in a database
  - [ ] *Settings* → stored in `chrome.storage.sync` (user's own profile)
  - [ ] *IP address* → rate limiting on the backend only
- [ ] If you later add any analytics or telemetry, update the policy and the dashboard disclosure **before** shipping it

## 4. Review-risk mitigations

- [ ] Re-read `docs/permissions-justification.md`; every permission in the manifest must match it
- [ ] Confirm the extension does not: auto-post, bulk-generate, scroll the feed, crawl profiles, access messages, or simulate activity
- [ ] Confirm the backend is reachable and healthy during review (`GET /health`)
- [ ] Confirm `ALLOWED_EXTENSION_ORIGIN` matches the published extension ID
- [ ] Provide the reviewer a working backend URL or document the local setup (reviewers cannot run `pnpm dev`)
- [ ] Ensure the side panel and content script show clear errors when the backend is unreachable

## 5. Versioning & release hygiene

- [ ] Bump `version` in `manifest.json` and `package.json` together
- [ ] Keep a `CHANGELOG.md` or release notes section in the store listing
- [ ] Tag releases in git (`v1.0.0` style)
- [ ] Test the exact zip that will be uploaded (`pnpm package:extension` regenerates it)

## 6. Post-submission

- [ ] Respond to any reviewer questions within 72 hours
- [ ] After approval, re-test the *published* (non-unpacked) version once
- [ ] Set up a channel (GitHub issues / contact email) for user bug reports about selector breakage — see `docs/linkedin-selector-maintenance.md`
