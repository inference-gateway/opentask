# Repository Guidelines

## Project Structure & Module Organization

This is a Chrome-first Manifest V3 extension built with Bun, TypeScript, and React. `src/content.ts` controls GitHub page integration, keyboard handling, and insertion. `src/background.ts` owns GitHub API access and caching. React views live in `src/ui/`, reusable DOM and matching helpers in `src/lib/`, and messages, prompts, and storage contracts in `src/shared/`. Static extension files include `manifest.json`, `src/options.html`, and `src/styles.css`. Tests are in `test/`; the generated load-unpacked bundle is written to `dist/` and should not be edited directly.

## Build, Test, and Development Commands

- `flox activate`: enter the pinned Bun and go-task environment.
- `task hooks:install`: required first step; configure Git to use `.githooks/`.
- `task setup`: install the hook and dependencies from `bun.lock`.
- `task check`: run typechecking, tests, and the production build.
- `task build`, `task test`, `task typecheck`: run an individual check.

For manual testing, rebuild, reload the unpacked `dist/` directory in `chrome://extensions`, then exercise an issue or pull-request comment box on GitHub. Run `task check` before submitting changes.

## Manual Verification

To sanity-check a UI change live, `task build`, reload the unpacked `dist/` in `chrome://extensions`, and exercise the surface you touched: the content script on a GitHub issue/PR comment box, or the side panel (`sidepanel.html`, which needs a running `infer` CLI bridge — configure it under Options → Orchestrator → *CLI Bridge*).

To iterate on side-panel layout/styling without standing up the CLI bridge, preview the component in isolation against the real compiled styles and screenshot it:

1. `task build` to regenerate `dist/options.css` (the side panel's stylesheet).
2. Write a small static `preview.html` that reproduces the component markup with the same Tailwind classes, and `<link>`s the compiled CSS. Copy `dist/options.css` next to the HTML and reference it relatively; add `class="dark"` on `<html>` to preview dark mode.
3. Serve the folder over HTTP — Chrome blocks `file://` for extension-style pages, so `python3 -m http.server` (or any static server) and open `http://localhost:<port>/preview.html`.
4. Screenshot in Chrome (a narrow ~400px window matches the panel) to confirm the rendering, then stop the server.

## Coding Style & Naming Conventions

Use TypeScript/TSX with ES modules, two-space indentation, double quotes, and semicolons, matching existing files. Keep strict types; avoid `any` when a message, view, or storage shape can be expressed explicitly. Use `camelCase` for functions and variables, `PascalCase` for React components and types, and descriptive lowercase filenames for utilities (for example, `src/lib/fuzzy.ts`). Keep browser-privileged API and cross-origin fetch logic in the background worker, not UI components. There is no separate formatter or linter, so preserve the established style and rely on `tsc` for static validation.

## Testing Guidelines

Tests use `bun:test` and follow the `test/*.test.ts` naming pattern. Add focused unit tests for matching, trigger boundaries, DOM helpers, and other pure behavior. Describe observable outcomes in test names. No coverage threshold is configured; cover regressions and edge cases introduced by each change. Run `task test` locally.

## Commit & Pull Request Guidelines

History follows Conventional Commit-style subjects such as `feat: ...`, `docs: ...`, `chore: ...`, and scoped forms like `ci(infer): ...`. Keep commits focused and subjects imperative. Pull requests should explain the behavior change, link relevant issues, list verification commands, and include screenshots or a short recording for UI changes. Never commit personal access tokens or `.env`; document new configuration in `.env.example` and `README.md`.
