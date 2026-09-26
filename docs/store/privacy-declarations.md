# Store Privacy Declarations

Reusable, copy-paste answers for the Web Store listing's **Privacy** tab. Keep these
in sync with `manifest.json` and [`PRIVACY.md`](../../PRIVACY.md). These declarations
apply identically to Chrome Web Store, Microsoft Edge Add-ons, and Firefox Add-ons.

## Single purpose

> Adds AI-agent tooling to GitHub's issue and pull request pages: skill
> tab-completion and a quick-prompts palette in the comment boxes, Tasks/Skills/Init
> panels in the repository navigation, a Refine button on issues, and a side panel
> (Chrome/Edge) that pairs with a local `infer` CLI to drive browser-use
> automation, with optional RunPod GPU provisioning for self-hosted models.

## Permission justifications

### `storage`
> Stores the user's settings on their own device: the editable quick-prompts list,
> orchestrator and agent settings (including an optional RunPod API key the user
> enters and local bridge port/token settings), and short-lived caches (a 10-minute
> per-repository skill cache and the agents catalog). Nothing is synced or sent to
> a server by the extension.

### Host permission - `https://api.github.com/*`
> Grants access to GitHub's REST API for listing a repository's skills and
> installing/managing its agent workflow. Requests run through the user's
> connected `infer` CLI (`gh api` on the CLI host), so the extension itself never
> stores or sends a GitHub token or credential.

### Host permission - `https://rest.runpod.io/*`
> Only used if the user configures their own RunPod API key (Options page,
> Orchestrator tab): it provisions and queries a self-hosted GPU pod that serves a
> llama.cpp OpenAI-compatible model endpoint. Without a RunPod key this host is
> never contacted.

### Host permissions - `http://*/*`, `https://*/*`, `<all_urls>`
> Used by the browser-use bridge: the user's locally connected `infer` CLI agent
> can navigate, read, and act in the tabs the user directs it to, and capture
> screenshots, from the side panel. Page data from these tabs goes only to the
> user's own local CLI bridge on localhost, not to the developer or any server.

### Content-script host access - `https://github.com/*`
> The content script runs on github.com to detect the issue/PR comment textarea,
> render the completion dropdown and prompts palette, inject the repo-nav items and
> the issue Refine button, and insert text at the caret. It reads only the focused
> comment box's value/caret and the page path (to resolve `owner/repo`); it does
> not read cookies or credentials.

## Remote code

> **No.** The extension executes no remotely hosted code. All logic ships in the
> package; network calls fetch JSON data (skill listings, the agents catalog,
> RunPod pod state), never code.

## Data usage disclosures

- **Data collected:** none is transmitted to the developer. There is no backend
  server, no analytics, and no telemetry.
- **Settings and API keys:** stored locally in `chrome.storage.local` on the
  user's device only. This includes an optional RunPod API key the user enters;
  the extension holds no GitHub credential (GitHub calls run through the user's
  own `gh` CLI on the connected CLI host).
- **Not sold or transferred** to third parties.
- **Not used** for anything unrelated to the single purpose above.
- **No creditworthiness / lending** use.

The full user-facing policy is [`PRIVACY.md`](../../PRIVACY.md), linked from the
store listing's *Privacy policy URL* field.