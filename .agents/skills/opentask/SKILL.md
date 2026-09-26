---
name: opentask
description: >
  Drive OpenTask - the inference-gateway Manifest V3 browser extension (`inference-gateway/opentask`) that surfaces a
  repo's skills and `@opentask` agent directives inside GitHub's comment box, issue/PR pages, and an injected repo-nav
  bar (Tasks / Skills / Init tabs). Use when operating a browser on github.com to send the OpenTask agent a
  custom prompt (not just a saved template), install the agent workflow, refine an issue in place after research, or
  manage skills/agents - and, crucially, to decide when a plain `gh` CLI call is faster than driving the UI at all.
  Also use when authoring, installing, or updating the GitHub Actions workflow that runs the agent on long-horizon
  tasks (`.github/workflows/tasks.yml` via `inference-gateway/infer-action`) - bumping the action version, adding
  inputs, or adapting the workflow to a repository's languages and CI conventions.
license: Apache-2.0
---

# OpenTask

Use this skill when you have a browser (or computer-use session) on `github.com`
and want to use [OpenTask](https://github.com/inference-gateway/opentask) - the
Manifest V3 extension that "makes GitHub great again" by injecting the org's repo
skills and `@opentask` bot directives into GitHub's own UI.

## The one rule: `@opentask` is just text - reach for `gh` first

The extension is a **convenience layer over plain text and the GitHub API**. The
agent fires on any issue/PR body or comment matching `@opentask` (case-insensitive);
its Refine/Init/Skills panels each just open a PR or dispatch a workflow. So if you
already have `gh` authenticated, you usually do **not** need the browser:

| To...                               | Fastest headless path (no browser)                      |
| ----------------------------------- | ------------------------------------------------------- |
| Trigger the agent on a new issue    | `gh issue create --title T --body "@opentask <prompt>"` |
| Trigger it on an existing thread    | `gh issue comment N --body "@opentask <prompt>"`        |
| Run a task with no public issue     | `gh workflow run <name>.yml -f prompt="..."`            |
| Refine an issue body                | comment `@opentask refine this issue`                   |
| Read/discover issues, skills, files | `gh issue view`, `gh api repos/O/R/contents/...`        |

Default to the CLI. Open the browser + OpenTask only when the surface has no
scriptable equivalent or a human wants the inline helpers: the `!` skill
autocomplete and quick-prompts palette (typing shortcuts), the Tasks-tab model
picker and "no public issue" dispatch when you don't know the workflow's inputs,
the one-click Skills/Init panels, the per-issue **Refine** button, and the
RunPod GPU popup.

## Launching the browser and using OpenTask

1. **Install the extension** (once). Until the store listing is approved: download
   `browser-extension.zip` from the
   [latest release](https://github.com/inference-gateway/opentask/releases), unzip,
   open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, select
   the extracted `dist/`.
2. **Connect the CLI bridge** (once, for private repos and any write action). Right-click the
   extension -> **Options** -> **Orchestrator** -> **CLI Bridge**: set the CLI port (default
   `52789`) and the shared token from `extension.token` in `~/.infer/browser_use.yaml`, then
   click **Connect** in the side panel. GitHub calls run `gh api` on that CLI's host; the
   extension stores no GitHub credential.
3. **Open the GitHub page** for the target repo/issue/PR and use a surface:
   - **Skill autocomplete**: focus a comment box, type `!` at the start of a word ->
     a caret-anchored dropdown of the repo's skills. Arrows navigate, `Tab`/`Enter`
     inserts the skill as `/<name>`, `Esc` closes. Native `@`/`#`/`:` completion is
     untouched.
   - **Quick Prompts palette**: `Ctrl/Cmd+Shift+P` (or the `⚡` toolbar button) opens
     a searchable palette of `@opentask` directives + editable templates; `Enter`
     inserts the selection at the caret.
   - **Repo-nav tabs** (injected into the repo's navigation bar):
     - **Tasks** - install the agent workflow (opens a PR), then send a free-text
       task. Leave _Create a GitHub issue_ checked to open an `@opentask` issue, or
       uncheck it to run directly via `workflow_dispatch` with no public issue.
     - **Skills** - multi-select the
       [skills registry](https://github.com/inference-gateway/skills) (repo languages
       suggested first); **Apply** opens one PR editing `.agents/skills/`.
     - **Init** - dispatch the workflow to scaffold `AGENTS.md` (+ optional githooks /
       symlinks) and open a PR.

## Custom prompts, not just templates

The palette ships four defaults (`@opentask`, Review PR, Fix issue, Work on issue),
but they are only starting text. To send **anything else**:

- In any comment box or the **Tasks** tab, type `@opentask` followed by your own
  prompt - free text is the whole point; templates are just shortcuts.
- To make a custom prompt permanent, edit **Options -> Quick prompts** (a JSON array
  of `{ id, label, description, insert }`); it then appears in the palette.
- Headless equivalent: put the exact same text in a `gh issue create`/`gh issue
  comment` body. `@opentask` anywhere in the text is the only requirement.

## Placeholder issue + Refine (pre-fill after research)

The laziest way to file a good issue: create a **one-line placeholder**, then let the
agent research and fill it in.

1. Create a stub issue - just a title and a short intent line (via the **Tasks** tab
   or `gh issue create --title "..." --body "@opentask"`).
2. Click the **Refine** button on the issue page (enable it in
   **Options -> Issue refinement**; _Auto-refine issues you create_ fires it
   automatically on new issues).
3. The agent reads the issue, **explores the repo** so the rewrite is grounded in how
   the project actually works, checks `.github/ISSUE_TEMPLATE/` for a matching
   template, and edits the body **in place** (`gh issue edit`) with a clear title,
   structured summary, and explicit acceptance criteria. Ambiguities land under an
   `## Open questions` section - answer them under each question and re-click Refine.

Refine is an in-place edit only (no branch/commit/PR), so it needs the **Create issues**
permission in **Options -> Workflows**; **re-install the workflow** after enabling it.

## Authoring the GitHub Actions workflow

Installing via the **Tasks** tab covers the common case. When you need to
author `.github/workflows/tasks.yml` by hand, update an existing workflow, bump
the `inference-gateway/infer-action` version, or adapt the workflow to a
repository's languages and CI conventions, read
[references/github-workflow.md](references/github-workflow.md).

## Notes and gotchas

- **Re-install after settings changes.** Permissions, Plugins, Agents, Issue
  refinement, and Workflow timeout are baked into the generated workflow - changing
  them in Options does nothing until you re-run **Install** on the repo.
- **Project board.** The installed workflow tells the agent to keep an issue's board
  Status in sync (In Progress -> Done), best-effort. Board writes need a token with
  `Projects: read and write` - enable the **Custom bot (GitHub App)** option in
  **Options -> Workflows**, since the default `GITHUB_TOKEN` can't reach Projects v2;
  otherwise board updates are skipped silently.
- **Self-hosted GPU (RunPod).** The popup's **GPU** section (appears once a RunPod key
  is set in Options -> Orchestrator) provisions a llama.cpp OpenAI-compatible pod and
  hands you `LLAMACPP_API_URL` / `LLAMACPP_API_KEY` / `DEFAULT_MODEL` to add under the
  repo's Actions secrets, then re-install. Each redeploy is a new URL+token;
  **Deprovision** to stop billing. This one genuinely needs the browser.
- **Privacy / no backend.** The extension stores no GitHub credential - GitHub calls
  run `gh api` on the connected infer CLI's host over the local CLI bridge. Other
  network traffic is limited to the agents catalog on jsDelivr and, if configured,
  the RunPod REST API; settings and prompts stay in this browser's local storage.
- **Composer support.** v1 targets the classic `<textarea>` comment box; the newer
  React/ProseMirror composer on some 2024+ pages isn't wired yet - fall back to `gh`
  there.
