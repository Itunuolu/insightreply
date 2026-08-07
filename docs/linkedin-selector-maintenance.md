# Maintaining LinkedIn Selectors

LinkedIn changes its DOM structure frequently, and the most common cause of a "broken" extension is a renamed class or restructured post card. This guide explains how the extension isolates that risk and how to fix it quickly.

## The single source of truth

**All selectors live in one file:**

```text
apps/extension/src/content/linkedin/selectors.ts
```

No other file may contain hard-coded LinkedIn class names or attribute selectors. If you find one, move it here.

The file exports ordered arrays of fallback selectors for each concern:

| Export | Purpose |
|---|---|
| `POST_CONTAINER_SELECTORS` | Post cards (feed and post pages) |
| `POST_TEXT_SELECTORS` | The post body text element |
| `AUTHOR_NAME_SELECTORS` | The author's display name |
| `COMMENT_ACTION_SELECTORS` | The button that opens the comment box |
| `COMMENT_EDITOR_SELECTORS` | The contenteditable comment editor |
| `ENGAGEMENT_BAR_SELECTORS` | The action bar used as the button anchor |
| `SEE_MORE_SELECTORS` | The "…see more" control (truncation detection) |

The adapter (`linkedin/adapter.ts`) walks each list in order and uses the first match that works, so a single renamed class does not break extraction — the fallbacks absorb it.

## How to diagnose a breakage

1. Open `linkedin.com` in Chrome and open DevTools (F12).
2. Inspect a post card element in the Elements tab.
3. Compare its current classes/attributes with `selectors.ts`.
4. Check each concern independently:
   - Button missing → `POST_CONTAINER_SELECTORS` / `ENGAGEMENT_BAR_SELECTORS`
   - Button present but "could not read post" → `POST_TEXT_SELECTORS` / `AUTHOR_NAME_SELECTORS`
   - Truncation warning on expanded posts → `SEE_MORE_SELECTORS`
   - "Comment editor not found" on insert → `COMMENT_ACTION_SELECTORS` / `COMMENT_EDITOR_SELECTORS`

## How to fix

1. Find the new stable marker in DevTools. Prefer, in order:
   1. Semantic attributes: `data-urn`, `data-testid`, `aria-label`
   2. Stable prefixed classes: `update-components-*`, `feed-shared-*`, `comments-*`
   3. Generic fallbacks: `[contenteditable="true"]` scoped to a form
2. Add the new selector **to the front** of the relevant array (most recent first). Keep old ones as fallbacks — LinkedIn often keeps them for some UI variants.
3. Update the static fixtures in `apps/extension/src/test/fixtures.ts` to include the new structure, so tests cover it.
4. Run:

```bash
pnpm --filter @insightreply/extension test
pnpm --filter @insightreply/extension typecheck
```

5. Rebuild and reload the extension:

```bash
pnpm dev:extension
# chrome://extensions → Reload
```

## Good-practice rules

- **Never** select on unstable suffixes (e.g. `ember-view` IDs, hash-suffixed classes like `artdeco-...` variants with trailing numbers).
- **Always** scope editor lookups to the selected post's container so you never touch another post's comment box.
- Keep `isVisible` checks cheap: `display:none` and disconnected nodes are the main noise sources; no layout polling.
- When LinkedIn removes a class entirely, remove the dead selector to keep the list clean — but wait two weeks first; LinkedIn sometimes A/B tests and restores it.

## Test fixtures

`apps/extension/src/test/fixtures.ts` mirrors realistic post structures (classic markup, `data-testid` markup, truncated posts, polls, open editors). When you update selectors, add a matching fixture and a test in `src/content/linkedin/__tests__/adapter.test.ts` (extraction) or `insert.test.ts` (editors). The Playwright smoke test then verifies the real bundled script against the same structures in a real browser.
