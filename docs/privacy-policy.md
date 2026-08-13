# Privacy Policy — InsightReply by Hadesh.ai

**Last updated:** 2026-08-12

This policy describes how the InsightReply Chrome extension and its configured backend handle your data. InsightReply is a user-controlled writing assistant: it helps you draft LinkedIn comments and replies and never acts on your behalf without your explicit action.

## What InsightReply does

1. You open LinkedIn in Chrome and browse normally. InsightReply shows a small "AI Comment" button near posts and an "AI Reply" button beside available Reply actions. The extension does **not** transmit your feed, posts, messages, connections, or other page content while you browse.
2. When you click "AI Comment" on a specific post, InsightReply extracts **only that post** (author display name, post text, and the page URL). When you click "AI Reply", it also extracts the selected incoming reply and, when available, the parent comment needed to understand that exchange.
3. When you press **Generate**, the selected conversation and your preferences (tone, length, language, perspective, optional writing profile) are sent to the backend you configured, which forwards them to the configured AI provider to produce suggestions.
4. You review, edit, copy, or insert a suggestion. **You** press Post or Reply on LinkedIn. InsightReply never submits or publishes content automatically.

## What data is processed

- **Selected conversation content.** This is the selected post and, for reply suggestions, the incoming reply and available parent comment. It is processed only when you request suggestions and sent to your configured backend and AI provider to fulfil that request.
- **Author display name and post URL.** Needed to preview the post and to insert comments into the correct post.
- **Your settings** (default tone, length, writing profile, backend URL). Stored in Chrome's `chrome.storage.sync`, which is scoped to your browser profile and Google account.
- **Selected conversation state.** Held in short-lived `chrome.storage.session`, which is cleared when your browser session ends.
- **IP address of the backend caller**, used only for rate limiting.

## What InsightReply does NOT do

- It does **not** automatically publish or submit comments.
- It does **not** sell, rent, or share your data with advertisers.
- It does **not** collect your LinkedIn credentials, passwords, or authentication tokens.
- It does **not** access private messages, connection lists, or profile histories.
- It does **not** transmit posts or comment threads you did not deliberately select.
- It does **not** scroll your feed, expand posts, or simulate human activity.
- It does **not** intentionally retain full LinkedIn posts. Selected post content is passed through for generation and is not stored in a database; logs deliberately exclude post content.

## Where data goes

- **The configured backend:** the production extension calls the InsightReply backend by default. Advanced users can configure a compatible self-hosted endpoint in Settings.
- **The AI provider:** the backend sends your selected post and preferences to its configured AI provider to generate suggestions. That provider processes the request under its applicable service terms and privacy policy.
- **No third-party analytics** are embedded in the extension.

## Retention

The InsightReply backend does not store posts in a database. Application logs contain request metadata (method, route, status, latency) and deliberately exclude post content and writing-profile text. The hosting provider and AI provider may process limited technical or request data under their respective service terms and retention policies.

## Your controls

- **Clear selected conversation** removes the current post or reply context from session storage immediately.
- **Clear settings** resets all stored settings.
- Removing the extension removes all extension-stored data in your browser profile.

## Confidential information

InsightReply is a writing assistant for public professional content. You should **avoid sending confidential information**. Any content you select may be transmitted to the AI provider as part of the generation request.

## Contact

Privacy questions: privacy@hadesh.ai (or the contact address published for the Hadesh.ai product).

---

**Important:** This policy is provided for transparency and reflects how the software currently behaves. It is not legal advice and does not constitute a claim of compliance with GDPR, CCPA, or any other specific regulation. Have this policy reviewed by qualified counsel before distribution.
