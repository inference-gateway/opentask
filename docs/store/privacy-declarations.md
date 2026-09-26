# Store Privacy Declarations

Reusable, copy-paste answers for the Web Store listing's **Privacy** tab. Keep these
in sync with `manifest.json` and [`PRIVACY.md`](../../PRIVACY.md). These declarations
apply identically to Chrome Web Store, Microsoft Edge Add-ons, and Firefox Add-ons.

## Single purpose

> Automates AI-coding-agent workflows on GitHub. It adds skill tab-completion and a
> quick-prompts palette to GitHub's comment boxes, injects a repo navigation bar
> (Tasks / Skills / Agents / Init) that installs and manages the OpenTask agent
> workflow, skills, and A2A agents, dispatches and refines agent tasks, can provision
> a RunPod GPU for self-hosted models, and pairs with the user's locally running
> `infer` CLI to drive browser automation from a side panel.

## Permission justifications

### `storage`
> Stores the user's settings on their own device: extension options (quick prompts,
> agent/workflow settings, theme), the RunPod API key (`runpod-key`), the local CLI
> bridge port and shared token (`bridge-port`, `bridge-token`), GPU pod state
> including its generated API key (`gpu-state`), selected agents (`selected-agents`),
> and short-lived caches of the skills/agents catalogs and per-repository skill
> listings. Nothing is synced or sent to a server.

### `activeTab`
> Grants the browser-use bridge access to the tab the user targets from the side
> panel (reading the visible page, capturing a screenshot) and lets the popup open
> the side panel on the current window. Access applies only to the tab the user is
> acting on.

### `tabs`
> Lets the bridge open, focus, inspect, and switch between tabs on the user's behalf
> (browser-use commands from the side panel) and focus the right window when an
> approval notification is clicked. Tab URLs are read only to execute the user's
> requested commands; they are not collected.

### `scripting`
> Injects helper scripts into tabs the user targets through the bridge, so the AI
> agent can read page state (interactive fields, field types) and interact with
> forms on the user's behalf. Only the user's approved commands are executed.

### `sidePanel`
> Opens the extension's side panel - the chat/browser-use UI paired with the local
> `infer` CLI - from the popup, from the approval notification, and from bridge
> commands.

### `alarms`
> A one-minute recurring alarm redials the local CLI bridge WebSocket when the
> service worker has been suspended, so an open side panel reconnects on its own.

### `notifications`
> Shows a system notification when the AI agent asks the user to approve a tool
> call from the side panel, so the request can be reviewed without watching the
> panel. The notification carries the tool name only; clicking it focuses the
> panel.

### Host permission - `https://api.github.com/*`
> The extension makes no direct request to this host and stores no GitHub token.
> All GitHub REST calls (skills listing, workflow install, issue creation, task
> dispatch) run as `gh api` commands on the user's own machine, executed by the
> local `infer` CLI through the bridge, so requests are authenticated with the
> user's existing `gh` login. The host permission is declared for the GitHub REST
> API surface the background worker targets; no request is sent from the extension
> to `api.github.com` today.

### Host permission - `https://rest.runpod.io/*`
> Lets the user provision and manage a self-hosted GPU pod (create, check status,
> delete) for serving their own models. Requests carry the user's RunPod API key,
> entered in Settings and stored only on the user's device.

### Host permissions - `http://*/*`, `https://*/*`, `<all_urls>`
> The browser-use bridge can be asked, from the side panel, to open, read, and
> interact with any tab the user directs it to, including http(s) pages. The broad
> host access is what lets `scripting` inject the helper scripts and
> `tabs.captureVisibleTab` take screenshots in the tab being controlled. Page
> content is read or modified only when the user sends a command for that tab; it
> is relayed only to the user's own locally running CLI.

### Content-script host access - `https://github.com/*`
> The content script runs on github.com to detect the issue/PR comment textarea,
> render the completion dropdown and prompts palette, insert text at the caret, and
> inject the Tasks/Skills/Agents/Init repo navigation. It reads only the focused
> comment box's value/caret and the page path (to resolve `owner/repo`); it does
> not read other page content, cookies, or credentials.

## Remote code

> **No.** The extension executes no remotely hosted code. All logic ships in the
> package; fetched resources are data only (JSON catalogs and API responses),
> never code.

## Data usage disclosures

- **Data collected:** none is transmitted to the developer. There is no backend
  server, no analytics, and no telemetry. Requests go to the hosts listed above
  (RunPod, a public JSON catalog) and to the user's own locally running `infer`
  CLI over `ws://127.0.0.1:<port>/ws`; GitHub calls run as `gh api` commands on
  the user's machine, authenticated with the user's own `gh` login.
- **Local storage:** settings, the RunPod API key (`runpod-key`), the CLI bridge
  port/token (`bridge-port`, `bridge-token`), GPU pod state including its
  generated API key (`gpu-state`), selected agents (`selected-agents`), and
  short-lived catalog/skill caches - all in `chrome.storage.local` on the user's
  device only.
- **Not sold or transferred** to third parties.
- **Not used** for anything unrelated to the single purpose above.
- **No creditworthiness / lending** use.

The full user-facing policy is [`PRIVACY.md`](../../PRIVACY.md), linked from the
store listing's *Privacy policy URL* field.