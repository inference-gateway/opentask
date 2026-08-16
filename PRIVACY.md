# Privacy Policy

**OpenTask** is a browser extension that surfaces a repository's
skills and common bot directives inside GitHub's issue/PR comment box. It has **no
backend server**, sends **no telemetry or analytics**, and collects **no personal
data**. This document describes every piece of data the extension touches.

## What is stored locally

All data lives in your browser via `chrome.storage.local` (local to this machine -
it is **never** synced to a cloud account and never leaves your device except as
described under [Network requests](#network-requests)). The extension uses exactly
three storage keys:

| Key | Contents | Set by |
| --- | --- | --- |
| `pat` | Your optional GitHub personal access token (only if you enter one). | Options page |
| `prompts` | Your editable quick-prompts list (`{ id, label, description, insert }`). | Options page |
| `skills:{owner}/{repo}` | A per-repository cache of skill folder names, valid for 10 minutes. | Automatically, after a skills lookup |

Nothing else is persisted. There are no cookies, no `localStorage`, no
`storage.sync`, and no first-party server that receives any of this.

## Network requests

The extension makes **one kind of external request**, and only to GitHub:

```
GET https://api.github.com/repos/{owner}/{repo}/contents/.agents/skills
```

- `{owner}/{repo}` is derived from the GitHub page you are viewing - you never type it.
- The request has **no body**; it only reads the list of skill folders.
- If (and only if) you have saved a personal access token, it is sent as an
  `Authorization: Bearer <token>` header so the request can see **private** repos.
  Without a token, requests are unauthenticated and only see public repos.
- These requests go to GitHub and are therefore subject to
  [GitHub's Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

No other host is ever contacted. There is no analytics, tracking, error-reporting,
or beacon traffic of any kind.

## The GitHub token

The personal access token is **optional** and only needed to list skills in private
repositories. Recommendation: a fine-grained token scoped to `Contents: read`.

- It is stored only in `chrome.storage.local` on this machine.
- It is used only to authenticate the GitHub Contents request above.
- It is never logged, never shown in error messages, and never sent anywhere other
  than `api.github.com`.

## How to delete your data

- **Remove the token:** open the extension's **Options** page and click **Remove
  token**. This deletes the `pat` key immediately. (Saving with the token field
  blank does the same.)
- **Remove everything:** uninstall the extension, or open `chrome://extensions`,
  find the extension, and use **Details → Clear data**. This wipes the token,
  quick prompts, and all cached skill listings.

## Permissions

The extension requests the minimum permissions it needs. Per-permission
justifications are documented in
[`docs/store/privacy-declarations.md`](docs/store/privacy-declarations.md).

## Contact

Questions or concerns? Open an issue at
<https://github.com/inference-gateway/opentask/issues>.
