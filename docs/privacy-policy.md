# Privacy Policy — InsightReply by Hadesh.ai

**Last updated:** 2026-08-06

This policy describes how the InsightReply Chrome extension and its optional self-hosted backend handle your data. InsightReply is a user-controlled writing assistant: it helps you draft LinkedIn comments and never acts on your behalf without your explicit action.

## What InsightReply does

1. You open LinkedIn in Chrome and browse normally. InsightReply shows a small "AI Comment" button near posts. The extension does **not** read your feed, your posts, your messages, your connections, or any other page content while you browse.
2. When you click the button on a specific post, InsightReply extracts **only that post** (author display name, post text, and the page URL) and shows it to you in its side panel.
3. When you press **Generate**, the selected post and your preferences (tone, length, language, perspective, optional writing profile) are sent to the backend you configured, which forwards them to the AI provider (OpenAI) to produce comment suggestions.
4. You review, edit, copy, or insert a suggestion. **You** press Post on LinkedIn. InsightReply never submits or publishes comments automatically.

## What data is processed

- **Selected post content.** Processed only when you request suggestions. It is sent to your configured backend and, from there, to the AI provider to fulfil your request.
- **Author display name and post URL.** Needed to preview the post and to insert comments into the correct post.
- **Your settings** (default tone, length, writing profile, backend URL). Stored in Chrome's `chrome.storage.sync`, which is scoped to your browser profile and Google account.
- **Selected post state.** Held in short-lived `chrome.storage.session`, which is cleared when your browser session ends.
- **IP address of the backend caller**, used only for rate limiting.

## What InsightReply does NOT do

- It does **not** automatically publish or submit comments.
- It does **not** sell, rent, or share your data with advertisers.
- It does **not** collect your LinkedIn credentials, passwords, or authentication tokens.
- It does **not** access private messages, connection lists, or profile histories.
- It does **not** collect posts you did not deliberately select.
- It does **not** scroll your feed, expand posts, or simulate human activity.
- It does **not** intentionally retain full LinkedIn posts. Selected post content is passed through for generation and is not stored in a database; logs deliberately exclude post content.

## Where data goes

- **Your backend:** the extension calls the backend URL configured in Settings (default `http://localhost:8787`, which you run yourself).
- **The AI provider:** the backend sends your selected post and preferences to OpenAI (or whatever provider you configure) to generate suggestions. That provider's own terms and privacy policy apply to your request.
- **No third-party analytics** are embedded in the extension.

## Retention

The backend does not store posts. No database is used. Logs contain request metadata (method, route, status, latency) and never include post content. OpenAI's retention policies for submitted prompts apply to the requests you make through your own API key.

## Your controls

- **Clear selected post** removes the current post from session storage immediately.
- **Clear settings** resets all stored settings.
- Removing the extension removes all extension-stored data in your browser profile.

## Confidential information

InsightReply is a writing assistant for public professional content. You should **avoid sending confidential information**. Any content you select may be transmitted to the AI provider as part of the generation request.

## Contact

Privacy questions: privacy@hadesh.ai (or the contact address published for the Hadesh.ai product).

---

**Important:** This policy is provided for transparency and reflects how the software currently behaves. It is not legal advice and does not constitute a claim of compliance with GDPR, CCPA, or any other specific regulation. Have this policy reviewed by qualified counsel before distribution.
