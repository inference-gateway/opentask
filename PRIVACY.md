# Privacy Policy

**OpenTask** is a browser extension that surfaces a repository's skills and
common bot directives inside GitHub's issue/PR comment box, installs and manages
the OpenTask agent workflow (skills, A2A agents, task dispatch), can provision a
RunPod GPU for self-hosted models, and pairs with your locally running `infer`
CLI to drive browser automation from a side panel. It has **no backend server**,
sends **no telemetry or analytics**, and collects **no personal data**. This
document describes every piece of data the extension touches.

## What is stored locally

All data lives in your browser via `chrome.storage.local` (local to this machine -
it is **never** synced to a cloud account). The extension stores:

| Key | Contents | Set by |
| --- | --- | --- |
| `prompts` | Your editable quick-prompts list (`{ id, label, description, insert }`). | Options page |
| `instructions`, `refinePrompt`, `permissions`, `refine`, `init`, `timeout`, `debug`, `reviewInline`, `visionModel`, `imageModel`, `plugins`, `dependencies`, `theme`, `bot` | Extension settings: agent instructions and permissions, refine/init prompts, job timeout, model hints, infer-action plugins, GitHub App bot config, and the UI theme. | Options page |
| `selected-agents` | The A2A agents you include when installing the workflow. | Agents panel |
| `runpod-key` | Your RunPod API key (only if you enter one in Settings). | Options page (Orchestrator tab) |
| `bridge-port`, `bridge-token` | The local `infer` CLI bridge's port and shared token. | Options page (Orchestrator tab) |
| `gpu-state` | The provisioned GPU pod's status, pod id, model, endpoint URL, and the pod's generated API key. | Automatically, after a GPU deploy |
| `skills:{owner}/{repo}` | A per-repository cache of skill folder names, valid for 10 minutes. | Automatically, after a skills lookup |
| `skills-catalog`, `agents-catalog` | Short-lived caches of the skills and agents registries, valid for 10 minutes. | Automatically, after a catalog lookup |

Nothing else is persisted. There are no cookies, no `localStorage`, no
`storage.sync`, and no first-party server that receives any of this.

## Network requests

The extension only contacts the endpoints below, and only when you use the
matching feature:

- **GitHub REST API** - GitHub data (skill listings, workflow check/install,
  skills registry, repo languages, issue creation, workflow dispatches) is
  fetched by running `gh api` commands **on your own machine**, executed by the
  local `infer` CLI over the bridge. The extension stores **no GitHub token**
  and attaches none; requests are authenticated with your existing `gh` login
  and are therefore subject to
  [GitHub's Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
- **RunPod REST API** (`https://rest.runpod.io/v1`) - creating, checking, and
  deleting the GPU pod you deploy. Requests carry your RunPod API key, sent as
  `Authorization: Bearer` by the extension itself.
- **Agents catalog** - a JSON fetch from
  `https://cdn.jsdelivr.net/gh/inference-gateway/agents@main/catalog.json`
  (public data, no credentials).
- **Local CLI bridge** - a WebSocket to `ws://127.0.0.1:<port>/ws` on your own
  machine (default port `52789`), authenticated with the shared token you set in
  Settings. This carries the side panel's chat with the CLI and the browser-use
  commands you send it. Nothing here leaves your device.

There is no analytics, tracking, error-reporting, or beacon traffic of any kind.

## How to delete your data

- **Remove everything:** uninstall the extension, or open `chrome://extensions`,
  find the extension, and use **Details → Clear data**. This wipes all settings,
  keys, and caches listed above.
- **Remove individual secrets:** open **Options → Orchestrator** and clear the
  RunPod API key, CLI bridge port, or shared token fields.

## Permissions

The extension requests the minimum permissions it needs. Per-permission
justifications are documented in
[`docs/store/privacy-declarations.md`](docs/store/privacy-declarations.md).

## Contact

Questions or concerns? Open an issue at
<https://github.com/inference-gateway/opentask/issues>.