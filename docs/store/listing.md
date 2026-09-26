# Chrome Web Store Listing

## Store description

### Short description (132 chars max)

Repo-skill tab-completion, quick-prompts, and browser-use automation for AI coding agents.

### Full description

OpenTask adds these productivity tools to GitHub's comment boxes, repository navigation, and side panel:

**Skill tab-completion.** Type `!` in a comment box to open a keyboard-navigable dropdown of the current repository's skills (fetched from `.agents/skills/` via the GitHub Contents API). Filter as you type with fuzzy matching. Press Tab or Enter to insert `/skill-name` at the caret.

**Quick-prompts palette.** Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) or click the lightning bolt button injected into the comment toolbar to open a searchable palette of `@opentask` directives plus editable templates. Select one to insert it at the caret.

**Repo-nav panels.** Tasks, Skills, and Init items added to GitHub's repository navigation: install the OpenTask agent workflow in the repo, browse a repository's skills, and initialize the OpenTask setup.

**Issue Refine.** A Refine button on issue pages sends the issue to the agent, which rewrites its description in place.

**Browser-use side panel.** Pairs with a local `infer` CLI over a localhost WebSocket so your agent can drive browser automation - navigating tabs, extracting content, capturing screenshots - with your approval.

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
3. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) - the quick-prompts palette should open as a centered overlay. Type to filter, Enter to insert.
4. Click the lightning bolt button in the comment toolbar - the same palette opens.
5. Right-click the extension icon -> Options (or chrome://extensions -> Details -> Extension options). The options page opens on the Workflows tab with tabs for Orchestrator, Agents, Prompts, Workflows, Dependencies, and Appearance. The editable quick-prompts JSON editor is under Prompts; Save and Reset to defaults buttons sit at the bottom of the page.
6. Verify the manifest requests the permissions that power the features above: `storage` (settings), `activeTab`, `tabs`, and `scripting` (browser-use automation driven by the CLI bridge), `sidePanel` (the side panel UI), `alarms` (reconnecting the local CLI bridge), `notifications` (agent approval prompts); host permissions for `https://api.github.com/*` (GitHub API access via the CLI's `gh`), `https://rest.runpod.io/*` (optional GPU provisioning), and `http://*/*`, `https://*/*`, `<all_urls>` (the tabs your agent automates); and a content-script match on `https://github.com/*`.

## URLs for the listing

- **Homepage URL**: https://github.com/inference-gateway/opentask
- **Privacy policy URL**: https://github.com/inference-gateway/opentask/blob/main/PRIVACY.md
- **Support URL**: https://github.com/inference-gateway/opentask/issues
