# Repository Guidelines

Chrome-first Manifest V3 browser extension built with Bun, TypeScript, and React. It surfaces repo skills and `@opentask` directives inside GitHub's comment box and injects a repo-nav bar (Tasks / Skills / Agents / Init).

## Commands

- `flox activate` — enter the pinned Bun + go-task environment.
- `task hooks:install` — required first step; points Git at `.githooks/`.
- `task setup` — install the hook and dependencies from `bun.lock`.
- `task check` — typecheck, test, and production build (run before submitting).
- `task build` / `task test` / `task typecheck` — individual checks.

Manual testing: `task build`, reload the unpacked `dist/` in `chrome://extensions`, then exercise a GitHub issue/PR comment box. The side panel (`sidepanel.html`) needs a running `infer` CLI bridge (Options → Orchestrator → *CLI Bridge*).

## Structure

- `src/content.ts` — imperative controller: DOM detection, caret math, insertion, keyboard, repo-nav injection.
- `src/background.ts` — service worker; owns GitHub API access, caching, and workflow/registry management.
- `src/ui/` — React views; `src/lib/` — DOM/matching helpers; `src/shared/` — messages, prompts, storage contracts.
- `dist/` is generated; never edit it directly.

## Style

TypeScript/TSX with ES modules, two-space indentation, double quotes, semicolons. Strict types; avoid `any` when a message/view/storage shape can be expressed. `camelCase` for functions and variables, `PascalCase` for components and types, lowercase filenames for utilities. Keep browser-privileged API and cross-origin fetch logic in the background worker, not UI components. No formatter or linter — rely on `tsc` and match existing files.

## Testing

`bun:test`, files named `test/*.test.ts`. Cover matching, trigger boundaries, DOM helpers, and other pure behavior; name tests by observable outcome. No coverage threshold — cover regressions and edge cases introduced by each change.

## Security

Never commit personal access tokens or `.env`. Tokens live in extension storage at runtime; document new configuration in `.env.example` and `README.md`.

## Commits & PRs

Conventional Commit subjects (`feat:`, `fix:`, `docs:`, `chore:`, scoped forms like `ci(infer):`). Keep commits focused, subjects imperative. PRs explain the behavior change, link issues, list verification commands, and include screenshots or a short recording for UI changes.
