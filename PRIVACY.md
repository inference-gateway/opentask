# Privacy Policy

**OpenTask** is a browser extension that surfaces a repository's
skills and common bot directives inside GitHub's issue/PR comment boxes, adds
Tasks/Skills/Init panels to GitHub's repository navigation and a Refine button to
issues, and pairs with a local `infer` CLI to drive browser-use automation from a
side panel. It has **no backend server**, sends **no telemetry or analytics**, and
collects **no personal data**. This document describes every piece of data the
extension touches.

## What is stored locally

All data lives in your browser via `chrome.storage.local` (local to this machine -
it is **never** synced to a cloud account and never leaves your device except as
described under [Network requests](#network-requests)). The extension stores:

| What | Contents |
| --- | --- |
| Your settings | The editable quick-prompts list, instruction/refine templates, orchestrator settings (permissions, plugins, dependencies, models, timeout, recording cap), bridge port/token, and theme - configured from the Options page |
| Agent selection | The agents you pick from the agents catalog on the Agents tab |
| Optional API keys | A RunPod API key, only if you enter one to self-host GPU models |
| Caches | A per-repository cache of skill folder names (valid 10 minutes) and the agents catalog |

Nothing is persisted outside `chrome.storage.local`, except the tab recordings you
hand to the agent - the connected `infer` CLI writes those into its own scratch
directory on your machine (see [Tab recordings](#tab-recordings)).
There are no cookies, no `localStorage`, no `storage.sync`, and no first-party
server that receives any of this.

## Tab recordings

When you click **Record tab** (Chrome and Edge only), the extension captures the
tab you asked it to record - locally, on your machine - and offers the finished
file to the side panel's composer as an attachment on your next message. Sending
it hands the bytes to your own `infer` CLI, which writes them into its scratch
directory on your machine so the agent it runs can inspect the capture. The
extension never uploads the recording anywhere, and it leaves your device only
through that local CLI. While a capture runs the extension draws a red outline on
that tab, and Chrome shows its own recording indicator; the outline is part of the
page, so it appears in the recording as well. The recording is deleted when you
delete the file the CLI wrote.

The prompt the extension puts in the composer names the frame extractor the agent
should use, `~/.infer/bin/tools/ffmpeg`. If your CLI has not downloaded it (it only
auto-downloads the *speech* binaries), the extension checks it with `infer binaries
status ffmpeg` through that CLI (approval-free; a sha256 match against the release) and,
when it reports missing or stale, installs it through the same CLI with `infer binaries
install ffmpeg`: the CLI fetches the platform build from
[`inference-gateway/binaries`](https://github.com/inference-gateway/binaries) into
`~/.infer/bin/tools/` on your machine, checked against the release checksums. The
extension fetches no script or binary itself and sees none of their bytes.

## Network requests

The extension talks to the following hosts:

- **Your local `infer` CLI bridge** (`ws://127.0.0.1:<port>/ws` plus
  `http://127.0.0.1:<port>` for artifacts). This is a server running on your own
  machine that you configure on the Options page (Orchestrator tab). GitHub API
  requests - listing a repository's skills and installing or managing its agent
  workflow - are executed by that CLI via `gh`, so **the extension never holds a
  GitHub token or credential**. GitHub sees your own authenticated `gh` requests,
  subject to [GitHub's Privacy
  Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
- **The agents catalog** on jsDelivr
  (`https://cdn.jsdelivr.net/gh/inference-gateway/agents@main/catalog.json`), to
  list the agents you can install.
- **The RunPod REST API** (`https://rest.runpod.io/v1`, plus the pod's proxy
  endpoint) - only if you configure your own RunPod API key, to provision and
  query a GPU pod that serves a llama.cpp OpenAI-compatible model endpoint.
- **The sites your agent automates.** With the browser-use bridge, the agent you
  run locally can navigate, read, and act in tabs you direct it to. Those requests
  are made by your own browser to the sites you choose; the extension does not
  route them anywhere else.

No analytics, tracking, error-reporting, or beacon traffic of any kind is sent to
the developer or any third party.

## Credentials

- The extension holds **no GitHub token**. GitHub API calls run through `gh` on
  your connected CLI host, using whatever authentication that CLI already has.
- A **RunPod API key** is optional and only needed to self-host GPU models. It is
  stored only in `chrome.storage.local` on this machine and is sent only to
  `rest.runpod.io` (and your pod's proxy endpoint).
- The **CLI bridge token** (optional) authenticates the extension to the bridge
  server on your own localhost. It is stored locally and sent only to
  `127.0.0.1`.

## How to delete your data

- **Remove everything:** uninstall the extension, or open `chrome://extensions`,
  find the extension, and use **Details → Clear data**. This wipes all settings,
  stored keys, and caches.
- Individual settings can be cleared from the Options page tabs before a Save.

## Permissions

The extension requests the minimum permissions it needs. Per-permission
justifications are documented in
[`docs/store/privacy-declarations.md`](docs/store/privacy-declarations.md).

## Contact

Questions or concerns? Open an issue at
<https://github.com/inference-gateway/opentask/issues>.