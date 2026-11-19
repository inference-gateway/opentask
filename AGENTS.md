# Repository Guidelines

Chrome-first Manifest V3 browser extension built with Bun, TypeScript, and React. It surfaces repo skills and `@opentask` directives inside GitHub's comment box and injects a repo-nav bar (Tasks / Skills / Init). README.md covers features and configuration. This file covers how to work on the code.
## Commands

- `flox activate` — enter the pinned Bun + go-task environment.
- `task hooks:install` — required first step, points Git at `.githooks/`.
- `task setup` — install the hook and dependencies from `bun.lock`.
- `task check` — typecheck, lint, test, and production build. Run before submitting (CI runs it on every PR).
- `task build` / `task test` / `task typecheck` / `task lint` — individual checks.
- `task format` — apply Biome formatting (the repo-wide pass has not been applied yet).
- `task build:firefox` / `task build:safari` — per-browser builds. `task package:chrome` / `task package:edge` / `task package:firefox` / `task package:safari` — store ZIPs, each running the matching build first.

The pre-commit hook runs typecheck, lint, and tests on every commit. Skip with `GIT_HOOKS_SKIP=1`.

Manual testing: `task build`, reload the unpacked `dist/` in `chrome://extensions`, then exercise a GitHub issue/PR comment box. The side panel (`sidepanel.html`) needs a running `infer` CLI bridge (Options → Orchestrator → *CLI Bridge*).

## Structure

- `src/content.ts` — imperative controller: DOM detection, caret math, insertion, keyboard, repo-nav injection.
- `src/background.ts` — service worker that owns GitHub API access, caching, and workflow/registry management.
- `src/ui/` — React views, `src/lib/` — DOM/matching helpers and the CLI bridge, `src/shared/` — messages, prompts, storage contracts.
- `build.ts` — build pipeline. Firefox/Safari manifests are shallow-merged over `manifest.json`. Removing a key (e.g. `side_panel`) must happen in `build.ts`, not the override files.
- `dist/` is generated. Never edit it directly.

## Style

TypeScript/TSX with ES modules, two-space indentation, double quotes, semicolons. Strict types - avoid `any` when a message/view/storage shape can be expressed. `camelCase` for functions and variables, `PascalCase` for components and types, lowercase filenames for utilities. Keep browser-privileged API and cross-origin fetch logic in the background worker, not UI components. Biome (`biome.jsonc`) lints and formats. `task lint` runs `biome check` in `task check` and the pre-commit hook and must stay clean — it gates both lint findings and formatting, including LF line endings and the final newline at the end of every file. `task format` applies Biome formatting.

### Code Readability

- Write self-explanatory code: clear names and small, single-purpose functions carry the intent.
  If a block needs a comment to be understood, extract it into a well-named function or variable.
- No inline comments inside function bodies.
- Doc comments on functions and types are at most 5 lines: what it does and why, not how.
- No comments above modules, packages, or files: no Go package doc comment above the `package`
  line, no Rust `//!` crate or module docs, no Python module docstring, no TypeScript `@fileoverview`
  or `@module` block, no file header.
- Document a struct, class, or record once above its declaration, not on each member. If a field
  needs explaining, rename it or fold the explanation into the type's doc comment.
- Prefer named constants or enums over magic numbers and strings. A bare literal is fine only
  where its meaning is obvious at a glance (0, 1, an empty string).
- Tool directives are not comments and stay where the tool needs them (lint suppressions, build
  tags, compiler pragmas, code generation markers).
- No semicolons in documentation prose (Markdown files, doc comments): split the sentence or use
  a dash instead.
- Examples (`examples/` directories, README snippets) are short and focused: one feature per
  example, the fewest lines that show it, and the exact command to run it.
- Every example must run as written. Verify it against the `tokenless` mock gateway, or against a
  real model such as `ollama_cloud/glm-5.3-flash` when the mock cannot cover it. Fix or delete an
  example that does not run.

## Testing

`bun:test`, files named `test/*.test.ts`. jsdom's `window`/`document`/`Event`/`KeyboardEvent` are preloaded globally by `bunfig.toml` → `test/setup.ts`, which deliberately does not expose `location` — stub it in tests instead of the real DOM. Cover matching, trigger boundaries, DOM helpers, and other pure behavior. Name tests by observable outcome. No coverage threshold — cover regressions and edge cases introduced by each change.

## Security

Never commit personal access tokens or `.env`. The extension stores no GitHub credential (GitHub auth comes from the host CLI's `gh`). The only secrets in `chrome.storage.local` are user-entered keys such as the optional RunPod API key. Document new configuration in `README.md`. When adding a manifest permission, document its justification in `docs/store/privacy-declarations.md` and check whether `manifest.firefox.json`/`manifest.safari.json` need the same change.

## Commits, Releases & PRs

Conventional Commit subjects (`feat:`, `fix:`, `docs:`, `chore:`, the repo-specific `impr:`, and scoped forms like `ci(infer):`) — semantic-release parses them to cut releases (`.releaserc.yaml`). Never hand-bump versions in `package.json`/`manifest.json` or edit `CHANGELOG.md`. Keep commits focused, subjects imperative. PRs explain the behavior change, link issues, list verification commands, and include screenshots or a short recording for UI changes.