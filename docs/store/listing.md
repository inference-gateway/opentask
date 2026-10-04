# Chrome Web Store Listing

## Store description

### Short description (132 chars max)

Repo-skill tab-completion, quick-prompts, and browser-use automation for AI coding agents.

### Full description

OpenTask adds these productivity tools to GitHub's comment boxes, repository navigation, and side panel:

**Skill tab-completion.** Type `!` in a comment box to open a keyboard-navigable dropdown of the current repository's skills (fetched from `.agents/skills/` via the GitHub Contents API). Filter as you type with fuzzy matching. Press Tab or Enter to insert `/skill-name` at the caret.

**Quick-prompts palette.** Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) or click the lightning bolt button injected into the comment toolbar to open a searchable palette of `@opentask` directives plus editable templates. Select one to insert it at the caret.

**Repo-nav panels.** Tasks, Skills, and Init items added to GitHub's repository navigation: Tasks sends a task to the agent as a new issue or a `workflow_dispatch` run, Skills installs and removes registry skills through a single pull request, and Init dispatches the workflow to generate an `AGENTS.md` and open a pull request. The agent workflow itself is installed from the extension's Options -> Workflows -> Install workflow.

**Issue Refine.** A Refine button on issue pages sends the issue to the agent, which rewrites its description in place.

**Browser-use side panel.** Pairs with a local `infer` CLI over a localhost WebSocket so your agent can drive browser automation - navigating tabs, extracting content, capturing screenshots - with your approval.

**Tab recording.** Click Record tab in the extension popup or side panel to capture the current tab (video only, 10 fps) and hand the clip to the composer with your next message, so the agent can watch the demonstrated flow and distill it into a reusable skill. The recording hard-stops at a configurable cap (default 60 s, bounded 5-300 s) and is sized to stay under GitHub's 10 MB attachment limit; it stays on your machine - the capture is offered to the composer, and your own `infer` CLI writes the file when the message is sent.

**Self-hosted GPU models (optional).** Provision a RunPod GPU pod that serves a llama.cpp OpenAI-compatible endpoint, using your own RunPod API key and the RunPod REST API.

**Privacy-first.** No telemetry, no analytics, and no backend of our own; settings stay in your browser's local storage. Network calls go to: the local CLI bridge over localhost (GitHub API requests run through `gh` on the CLI host, so the extension never holds a GitHub token), the agents catalog on jsdelivr, and - only when you configure them - the RunPod REST API for GPU provisioning and the sites your agent automates from the side panel (the reason for the broad host permissions).

## Screenshots

Capture these screenshots at 1280x800 on a GitHub issue or PR page:

1. **Skill dropdown** - Focus a comment textarea, type `!`, and show the fuzzy-filtered skill dropdown with keyboard navigation visible.
2. **Quick-prompts palette** - Open the palette (Ctrl+Shift+P) showing the searchable list of bot directives.
3. **Options page** - The extension options page showing the Orchestrator, Agents, Prompts, Workflows, Dependencies, and Appearance tabs; capture the Prompts tab with the editable quick-prompts JSON editor.

## Reviewer instructions

1. Open any GitHub issue or pull request (e.g. https://github.com/octocat/Hello-World/issues/1).
2. Focus the comment textarea and type `!` - a dropdown of repo skills should appear below the caret. Arrow keys navigate, Tab/Enter inserts, Esc closes.
3. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) - the quick-prompts palette should open just below the caret of the focused comment box. Type to filter, Enter to insert.
4. Click the lightning bolt button in the comment toolbar - the same palette opens.
5. Right-click the extension icon -> Options (or chrome://extensions -> Details -> Extension options). The options page opens on the Workflows tab with tabs for Orchestrator, Agents, Prompts, Workflows, Dependencies, and Appearance. The editable quick-prompts JSON editor is under Prompts; Save and Reset to defaults buttons sit at the bottom of the page.
6. Verify the manifest requests the permissions that power the features above: `storage` (settings), `activeTab`, `tabs`, and `scripting` (browser-use automation driven by the CLI bridge), `sidePanel` (the side panel UI), `alarms` (reconnecting the local CLI bridge), `notifications` (agent approval prompts), `tabCapture` (the Record tab control captures the current tab on the user's explicit click), and `offscreen` (the invisible recorder document that runs MediaRecorder for that capture and closes when it finishes); host permissions for `https://rest.runpod.io/*` (optional GPU provisioning), and `http://*/*`, `https://*/*`, `<all_urls>` (the tabs your agent automates); and a content-script match on `https://github.com/*`.

## Privacy tab declarations

The Privacy tab's permission fields take the copy-paste answers from [`docs/store/privacy-declarations.md`](./privacy-declarations.md). The tab-recording release adds two entries - `tabCapture` (the Record tab control) and `offscreen` (the invisible recorder document that runs MediaRecorder) - alongside the existing answers for `storage`, `activeTab`, `tabs`, `scripting`, `sidePanel`, `alarms`, and `notifications`.

The manifest pins `minimum_chrome_version` to 116, Chrome's floor for the promise-based `tabCapture.getMediaStreamId` and `chrome.offscreen` APIs the recording uses. Both Chromium stores accept the key - Edge uploads the same Chrome manifest and sets its store floor independently - and current Chrome and Edge builds are well past 116, so the release ZIP `browser-extension.zip` (attached to the GitHub release) passes store package validation as is.

## URLs for the listing

- **Homepage URL**: https://github.com/inference-gateway/opentask
- **Privacy policy URL**: https://github.com/inference-gateway/opentask/blob/main/PRIVACY.md
- **Support URL**: https://github.com/inference-gateway/opentask/issues
