# Permissions Justification — InsightReply

This document explains every permission in `apps/extension/manifest.json`, what it is used for, and why nothing more is requested.

## Declared permissions

```json
"permissions": ["storage", "activeTab", "scripting", "sidePanel"],
"host_permissions": ["https://*.linkedin.com/*"]
```

### `storage`

Used for two scopes:

- `chrome.storage.sync` — user settings (default tone, length, writing profile, backend URL). Synced across the user's own Chrome profile.
- `chrome.storage.session` — the **currently selected conversation only** (a post or a post plus selected reply context; short-lived and cleared when the browser restarts). This lets the content script, service worker, and side panel share one deliberate selection without long-term persistence.

No full posts are ever written to `chrome.storage.local` or retained long-term.

### `activeTab`

Used as a belt-and-braces fallback: when the user invokes the extension on a tab, `activeTab` grants temporary access to that tab's page. The content script is declared statically for LinkedIn, so `activeTab` is mostly a fallback for the rare case where LinkedIn served a variant that did not match the declared content-script patterns. It does not grant access to cookies, private messages, or other sites.

### `scripting`

Used by the service worker in exactly one defensive path: if a LinkedIn tab exists but its content script did not load (e.g., the page was navigated after the post was selected), `chrome.scripting.executeScript` re-injects the bundled `content.js` so the user's "Insert into LinkedIn" action still works. The injected code is always the locally bundled script — never remote code.

### `sidePanel`

Required by the Chrome Side Panel API to open the extension's own side panel from the toolbar icon and from content-script clicks. The side panel runs only locally bundled code.

## Host permissions

| Pattern | Why |
|---|---|
| `https://*.linkedin.com/*` | The content script must run on LinkedIn feed and post pages to show AI Comment and AI Reply controls, read the conversation the user selects, and insert the chosen draft into the correct comment or reply editor. This is the only host permission the extension requests. |

**Why there is no host permission for the backend.** The side panel reaches the
configured backend with an ordinary cross-origin `fetch`, and the backend
answers the preflight with `Access-Control-Allow-Origin` for the extension's own
origin. Because CORS grants the access, no host permission is needed — so the
extension does not ask for one, and users who point it at their own deployment
do not have to grant a new permission for that host. This was verified against a
build whose manifest lists only `https://*.linkedin.com/*`.

The backend's `ALLOWED_EXTENSION_ORIGIN` allow-list still gates every browser request, so removing the host permission does not widen what the backend accepts.

## What the extension does NOT have access to

- **No `cookies`, `webRequest`, or `<all_urls>`** — LinkedIn cookies and traffic are never touched.
- **No `tabs` permission** — we only message the tab the user selected (the service worker remembers its id in session storage).
- **No `notifications`, `alarms`, `background` fetch loops, `storage.local`** — there are no background generation jobs, no bulk behaviour, nothing runs when the user is not using the panel.
- **No third-party host origins** other than the backend.

## Why no `https://*/*` or `<all_urls>`

InsightReply is strictly limited to LinkedIn pages and the user's configured backend. A broad host permission would violate the product's privacy promise and would be harder to justify in a Web Store review.

## Content Security Policy

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

No remote scripts, no remote styles, no `eval`. Every executable byte is bundled at build time.
