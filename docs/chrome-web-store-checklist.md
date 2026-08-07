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
  - [ ] Side panel opens from the toolbar icon and from the button
  - [ ] Generate → 3 suggestions → edit → copy → insert → manual review → manual post
  - [ ] Truncated post shows the expand-first notice
  - [ ] Replace/Append/Cancel flow works with pre-filled editor text

## 2. Store listing content

- [ ] **Name:** InsightReply — AI Comment Assistant (≤ 45 chars; avoid duplicate names)
- [ ] **Short description** (≤ 132 chars) e.g. *"Write thoughtful, relevant LinkedIn comments from the posts you choose — you review and post everything yourself."*
- [ ] **Detailed description** (≤ 16,000 chars): what it does, how it works, user control emphasis, privacy summary, link to the privacy policy
- [ ] **Screenshots** (1280×800 or 640×400, up to 5): side panel with preview, tone/length pickers, results with three suggestions, settings
- [ ] **Promo tile** (440×280) and **small tile** (440×280) from the branded assets
- [ ] **Category:** Productivity; **Language:** en
- [ ] **Homepage URL:** your product page (optional but recommended)

## 3. Privacy practice

- [ ] Publish `docs/privacy-policy.md` at a stable URL and submit it in the Developer Dashboard
- [ ] **Single purpose:** "generate draft comments for LinkedIn posts"
- [ ] **Data usage table** in the dashboard:
  - [ ] *Post content the user selects* → transmitted for the sole purpose of generating suggestions → not stored
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
