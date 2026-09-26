<h1 align="center">OpenTask</h1>

<p align="center">
  <!-- License Badge -->
  <a href="https://github.com/inference-gateway/opentask/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/inference-gateway/opentask?color=blue&style=flat-square" alt="License"/>
  </a>
  <!-- Manifest Badge -->
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3"/>
  <!-- Built With Badge -->
  <img src="https://img.shields.io/badge/built%20with-Bun%20%2B%20React-blue?style=flat-square" alt="Built with Bun + React"/>
  <!-- Safari Badge -->
  <img src="https://img.shields.io/badge/Safari%20Web%20Extension-ready-brightgreen?style=flat-square" alt="Safari Web Extension ready"/>
  <!-- Release Badge -->
  <a href="https://github.com/inference-gateway/opentask/releases">
    <img src="https://img.shields.io/github/v/release/inference-gateway/opentask?style=flat-square&label=Release" alt="Latest Release"/>
  </a>
</p>

A Manifest V3 browser extension for AI coding agents. It makes the org's **repo
skills** and common **bot directives** discoverable right inside GitHub's issue/PR
comment box, and pairs with the `infer` CLI to drive **browser-use** automation in
any tab from a side panel. Built Chrome-first but deliberately portable to Edge,
Firefox, and Safari.

> **Chrome Web Store listing is under review.** In the meantime, install directly
> from the [latest release ZIP](https://github.com/inference-gateway/opentask/releases).

- [Key Features](#key-features)
- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Privacy](#privacy)
- [Multi-Browser Support](#multi-browser-support)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Key Features

- 📜 **Open Source**: Available under the Apache 2.0 License.
- ⚡ **Skill Tab-Completion**: Type `!` in a comment to open a caret-anchored,
  keyboard-navigable dropdown of the current repo's skills, fuzzy-filtered as you type.
- 🎛️ **Quick Prompts Palette**: A searchable palette of `@opentask` directives plus
  editable templates. Open with `Ctrl/Cmd+Shift+P` or the `⚡` toolbar button.
- 🔍 **Repo-Aware**: Resolves `owner/repo` from the page and fetches
  `.agents/skills/` via the GitHub Contents API, cached per repo.
- 🤝 **Non-Intrusive**: Never touches GitHub's native `@` / `#` / `:` completion;
  insertions fire an `input` event so draft-autosave and preview stay in sync.
- 🌐 **Multi-Browser Ready**: One `dist/` bundle; only `chrome.storage` is used, so
  a port is a manifest tweak, not a rewrite.
- 🔒 **Private-Repo Support**: The extension stores no GitHub credential. Every
  GitHub call runs `gh api` on the host of the connected infer CLI, so private repos
  work with the `gh` login that CLI already has.
- 🚀 **Agent Install**: Install or update the OpenTask Agent workflow from
  **Options → Workflows → Install workflow**. It lists your repos through the
  connected CLI's `gh` auth and sends `/install-opentask owner/repo` into the CLI
  chat; you approve the push and pull request in the side panel.
- 🧩 **Skills Install/Uninstall**: In the repo's **Skills** tab (repo nav), a
  searchable, multi-select list of the [Inference Gateway skills registry](https://github.com/inference-gateway/skills).
  Skills matching the repo's top languages are suggested first; applying opens a single PR
  that adds/removes skill folders under `.agents/skills/`.
- 🤖 **Agent Selection**: Pick A2A agents from the
  [agents registry](https://github.com/inference-gateway/agents) in
  **Options → Agents** to include in the workflow. Selected agents are spun up
  alongside the OpenTask agent at runtime.
- 📝 **Free-Text Tasks**: The **Tasks** tab sends a task to the agent. Leave **Create a
  GitHub issue** checked to open an `@opentask` issue, or uncheck it to run the task directly
  via `workflow_dispatch` (infer-action's `direct-prompt`) with no public issue.
- 🏗️ **Project Init**: The **Init** tab (repo nav) dispatches the installed workflow to
  scaffold an `AGENTS.md` for the repo and open a PR. Optional extras (configured in
  Settings) include a `.githooks/pre-commit` hook, a `CLAUDE.md` → `AGENTS.md` symlink,
  and a `.claude/skills` → `.agents/skills` symlink.
- 📋 **Project Board Tracking**: The installed workflow tells the agent to keep an issue's
  project-board Status in sync (In Progress on start, Done on completion), best-effort and
  board-agnostic. Board writes need a token with `Projects: read and write` - enable the
  GitHub App option, since the default `GITHUB_TOKEN` can't reach Projects v2; without it
  the agent skips board updates silently.
- 🤝 **GitHub App Bot**: Run the agent as your own GitHub App instead of
  `github-actions[bot]`. When configured, the workflow mints an installation token via
  `actions/create-github-app-token` and checks out + comments as the App, so its
  comments and commits are attributed to (and verified for) the App.
- 🖥️ **Self-Hosted GPU Models**: From the extension popup, provision a [RunPod](https://runpod.io)
  GPU that serves a llama.cpp OpenAI-compatible endpoint. Pick a catalog GGUF (or any custom
  Hugging Face `repo:quant`), choose a GPU, and deploy; the popup then hands you the repo
  secrets/variable to route tasks at `llamacpp/<model>`. See [Self-hosted GPU models](#self-hosted-gpu-models-runpod).
- 🧩 **Plugin Support**: Optional [infer-action plugins](https://github.com/inference-gateway/infer-action)
  extend the agent's capabilities. Toggle them on in Settings and re-install the workflow
  to bake them in.
- 🔧 **Configurable Permissions**: Control what the agent may do at runtime: create PRs,
  create issues, and comment on issues/PRs. Unchecked capabilities stay blocked.
- ⏱️ **Configurable Timeout**: Set the per-run job timeout for the generated workflow
  (default 25 minutes).

## Overview

On the first `!`, the extension resolves `owner/repo` from the page URL and asks the
background service worker to run
`gh api repos/{owner}/{repo}/contents/.agents/skills` on the CLI host over the
[CLI bridge](#cli-bridge), caching the result per repo for 10 minutes. The list also
includes the skills of enabled plugins. Repos with no skills directory simply show
nothing - native completion is untouched.

The quick-prompts palette is a self-contained popup opened by a keyboard shortcut or a
`⚡` button injected into the comment toolbar. Both surfaces share the same insertion
path, which writes through the native textarea setter so React-controlled composers and
GitHub's own draft/preview state stay consistent.

The **Tasks**, **Skills**, and **Init** tabs are injected into GitHub's repo
navigation bar by the content script. Each opens a popover panel that communicates
with the background service worker to send tasks, manage skills, or scaffold project
files. Agent selection lives in the options page (**Options → Agents**).

## Installation

**From a release ZIP** (recommended until the store listing is approved):

[![Latest Release](https://img.shields.io/github/v/release/inference-gateway/opentask?style=flat-square&label=Download%20Release)](https://github.com/inference-gateway/opentask/releases)

1. Download the `browser-extension.zip` from the [latest release](https://github.com/inference-gateway/opentask/releases).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** and select the `dist/` folder inside the extracted ZIP.
5. Open any GitHub issue/PR, focus the comment box, and type `!`.

**Manual (unpacked)** for development or self-building:

```bash
bun install
bun run build      # outputs dist/
```

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** and select the `dist/` folder.
4. Open any GitHub issue/PR, focus the comment box, and type `!`.

## Usage

> **Prerequisite:** most features - skill listing, Send/Run task, Skills apply, Init,
> Refine, and installing the workflow - need the [CLI bridge](#cli-bridge). Set it up
> under **Options → Orchestrator → CLI Bridge**, then click **Connect** in the side
> panel.

- **Skills**: type `!` at the start of a word to open the dropdown. Arrow keys
  navigate, `Tab` / `Enter` inserts `/`, `Esc` closes.
- **Quick prompts**: press `Ctrl/Cmd+Shift+P` (or click the `⚡` toolbar button) to
  open the palette, filter, and `Enter` to insert the selected template at the caret.
- **Install the agent**: open **Options → Workflows → Install workflow**, pick an
  owner and repository, and click **Install** to open a PR that adds the OpenTask
  Agent workflow. The run streams in the side panel, where you approve the push and
  the pull request.
- **Send a task**: in the **Tasks** tab, type a prompt and choose whether to create a
  GitHub issue or dispatch the workflow directly.
- **Manage skills**: the **Skills** tab shows the skills registry, filtered by the
  repo's languages. Check skills to install and uncheck to remove, then click **Apply**
  to open a PR.
- **Select agents**: in **Options → Agents**, check the A2A agents you want included
  in the workflow, then re-install to bake them in.
- **Init a project**: the **Init** tab dispatches the workflow to generate an
  `AGENTS.md` and open a PR. Configure extras (githooks, symlinks) in Settings.
- **Refine an issue**: on issue pages, a **Refine** button appears in the header
  (if enabled in Settings). Click it to have the agent rewrite the issue's description
  in place. Auto-refine on new issue creation is also configurable.

## Configuration

Right-click the extension → **Options** (or the Details page → *Extension options*).
Settings are grouped into six tabs: **Orchestrator**, **Agents**, **Prompts**,
**Workflows**, **Dependencies**, and **Appearance**.

### CLI bridge

The extension holds no GitHub token: every GitHub call runs `gh api` on the host of
the connected [infer](https://github.com/inference-gateway) CLI with its existing
`gh` login, so private repos work without any credential stored in the browser. The
bridge also powers skill listing, Send/Run task, Skills apply, Init, Refine, and
installing the workflow - without it, those features fail with *"Connect the infer
CLI to use GitHub features"*.

Under **Options → Orchestrator → CLI Bridge**:

- **CLI port**: the port the CLI's browser-use server listens on (default `52789`).
- **Shared token**: copy `extension.token` from `~/.infer/browser_use.yaml`
  (`infer init` seeds one).

Then open the side panel and click **Connect**.

### Quick prompts

A JSON array of `{ id, label, description, insert }` objects shown in the palette.
Editable, with a *Reset to defaults* button.

### Self-hosted GPU models (RunPod)

Instead of a hosted provider, you can run a model yourself on an on-demand GPU and
point tasks at it. OpenTask provisions a [RunPod](https://runpod.io) pod running
[`llama.cpp`](https://github.com/ggml-org/llama.cpp)'s server (image
`ghcr.io/ggml-org/llama.cpp:server-cuda`), which exposes an OpenAI-compatible
endpoint the [Inference Gateway](https://github.com/inference-gateway) reaches via the
`llamacpp` provider.

**1. Add your RunPod key.** Options → **Orchestrator** → *RunPod API key* (from
[RunPod settings](https://www.runpod.io/console/user/settings)). Stored in this
browser's extension storage. The **GPU** section in the popup only appears once a key
is set.

**2. Deploy.** Open the extension popup:

- Pick a catalog GGUF (Ornith 1.0 9B, Llama 3.1 8B, Qwen 2.5 7B, Mistral 7B, Phi-4,
  Gemma 2 9B) **or** type any Hugging Face ref in *custom HF repo:quant* (e.g.
  `unsloth/Qwen2.5-32B-Instruct-GGUF:Q4_K_M`). Ornith 1.0 9B is the default - it's a
  small model tuned for agentic tool-calling, unlike general chat GGUFs.
- Choose a GPU (RTX 4090 → A100 80GB). The pod is pinned to hosts with CUDA ≥ 12.8
  (the image's requirement) and secured with a generated `--api-key` bearer token.
- Hit **Deploy**. Status goes *provisioning → running*; the model's GGUF downloads and
  loads on the pod first (watch the pod's logs for `server is listening`).

**3. Wire it into the repo.** Once running, the popup shows copy-to-clipboard rows -
add them under the repo's **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `LLAMACPP_API_URL` | the pod endpoint + `/v1` |
| Secret | `LLAMACPP_API_KEY` | the generated bearer token (masked; **Copy** copies the real value) |
| Variable | `DEFAULT_MODEL` | `llamacpp/<repo:quant>` (the model the gateway registers) |

`DEFAULT_MODEL` is the model used for every run that does not name one explicitly -
issue-triggered runs, **Refine**, and **Init**. Only **Run task** can override it, via
the Tasks-tab model dropdown; it offers a curated list of hosted models, the running
llama.cpp model when one is up, and *Repository default (DEFAULT_MODEL)*. Then
**re-install the workflow** so it wires the `LLAMACPP_*` secrets onto infer-action.

> **Each redeploy is a new pod** with a new URL and token - update `LLAMACPP_API_URL`
> and `LLAMACPP_API_KEY` again from the popup. **Deprovision** from the popup terminates
> the pod so it stops billing.

### Permissions

What the OpenTask agent may do while a task runs. These widen infer-action's read-only
baseline; unchecked capabilities stay blocked. **Re-install the workflow** after
changing these.

- **Create pull requests** (commit & push)
- **Create GitHub issues**
- **Comment on issues & pull requests**

### Issue refinement

Let the OpenTask agent rewrite an issue's description in place. Refine edits the issue
body via `gh issue edit`, so the installed workflow needs **Create GitHub issues**
permission above - **re-install** after enabling.

- **Show a Refine button on issue pages** (default on)
- **Auto-refine issues you create on GitHub** (default off)

### Project init

What the **Init** button (in a repo's nav) asks the agent to scaffold. It always
generates an `AGENTS.md` and opens a PR; these add optional extras. Requires the
OpenTask Agent workflow to be installed on the repo.

- **Add a `.githooks/pre-commit` hook**
- **Symlink `CLAUDE.md` → `AGENTS.md`**
- **Symlink `.claude/skills` → `.agents/skills`**

### Workflows

- **Install workflow**: pick an owner and repository (listed from the connected CLI's
  `gh api user/repos`) and click **Install**. The CLI's agent adds or updates
  `.github/workflows/tasks.yml` and opens a pull request; approve the push and PR in
  the side panel. Re-installing updates the same open PR and preserves
  repo-specific customizations.
- **Custom bot (GitHub App)**: when enabled, the generated workflow authenticates as
  your GitHub App instead of `github-actions[bot]`. Create an App via the provided
  link, then enter its Client ID and the name of the repo secret holding its private
  key. The App needs `Contents: write`, `Issues: write`, `Pull requests: write`,
  `Actions: write`, and `Workflows: write`.
- **Timeout (minutes)**: per-run job timeout for the generated workflow (default 25).
  Applies to newly installed workflows; re-run **Install** on a repo to update an
  existing one.

### Plugins

Optional [infer-action](https://github.com/inference-gateway/infer-action) plugins
the installed workflow pre-installs to extend the agent. All off by default; check
the ones you want. **Re-install the workflow** after changing these.

### Theme

Choose how the options page and toolbar popup are displayed: **System default**,
**Light**, or **Dark**.

## Privacy

Everything the extension stores (your settings, the CLI bridge port and shared token,
and a short per-repo skill cache) stays in this browser's local storage - nothing is
synced or sent to a first-party server. GitHub calls run as `gh api` on the CLI host,
and the bridge talks only to the local CLI; there is **no backend and no telemetry**. See
[PRIVACY.md](PRIVACY.md) for the full data-flow breakdown and how to delete stored
data; per-permission justifications for the store listing live in
[docs/store/privacy-declarations.md](docs/store/privacy-declarations.md).

## Multi-Browser Support

The same `dist/` is the whole extension, and the only privileged API used is
`chrome.storage` (present on Chrome/Edge/Firefox). Per-browser notes:

| Browser      | What's needed                                                            |
| ------------ | ------------------------------------------------------------------------ |
| Chrome, Edge | Works as-is (`background.service_worker`). Chrome Web Store and Edge Add-ons use the same `dist/` ZIP. |
| Firefox 109+ | Build with `task build:firefox` (applies `manifest.firefox.json` overrides: `background.scripts` + `browser_specific_settings.gecko.id`). |
| Safari 16.4+ | Build with `task build:safari`, then wrap with `xcrun safari-web-extension-converter` on macOS. See [`docs/store/safari-listing.md`](docs/store/safari-listing.md) for the full packaging and App Store release guide. |

If the API surface ever grows beyond `chrome.storage`, drop in Mozilla's single-file
`webextension-polyfill` and alias `browser` → `chrome`.

## Development

Activate the Flox environment, then install the repository's pre-commit hook before
making changes:

```bash
flox activate
task hooks:install  # required first-time setup
task setup          # installs the hook and Bun dependencies
task check          # typecheck, test, and build
```

Layout: `src/content.ts` is the imperative controller (DOM detection, caret math,
insertion, keyboard, repo-nav injection of the Tasks/Skills/Init tabs); `src/ui/*`
holds the comment-box surfaces (skill menu, palette, Tasks/Skills/Init panels);
`src/options.tsx` and `src/ui/options/*` are the settings tabs; `src/background.ts`
is the service worker that fetches and caches skills, manages workflows, and proxies
every GitHub call through the CLI bridge (`src/lib/bridge.ts`).

To produce a store ZIP:

```bash
task package:chrome    # builds, zips dist/ to browser-extension.zip, writes SHA-256
task package:edge      # same ZIP, named edge-extension.zip for Edge Add-ons
task package:firefox   # builds with Firefox manifest, zips to firefox-extension.zip, writes SHA-256
task build:safari      # builds with Safari manifest; see docs/store/safari-listing.md for Xcode conversion
```

The ZIPs are also built and attached automatically to every GitHub Release by the
release workflow.

## Roadmap

- The newer React/ProseMirror composer on some 2024+ issue pages (v1 targets the
  classic `<textarea>`).
- Skill descriptions in the dropdown (would cost one API call per skill; names only
  for now, one call per repo).
- An org-wide skill catalog (v1 is per-repo).
- A packaged icon set, a build-time watch mode, and CI.

## Contributing

Found a bug or have a feature in mind? You're more than welcome to open issues or submit
pull requests for any fixes, improvements, or new ideas. Read the
[Repository Guidelines](AGENTS.md) before contributing; they cover project structure,
testing, style, commits, and pull-request expectations.

## License

This project is licensed under the Apache 2.0 License.
