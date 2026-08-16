# Chrome Web Store Listing

## Store description

### Short description (132 chars max)

Repo-skill tab-completion, quick-prompts, and browser-use automation for AI coding agents.

### Full description

OpenTask adds two productivity tools to GitHub's classic textarea comment composer:

**Skill tab-completion.** Type `!` in a comment box to open a keyboard-navigable dropdown of the current repository's skills (fetched from `.agents/skills/` via the GitHub Contents API). Filter as you type with fuzzy matching. Press Tab or Enter to insert `/skill-name` at the caret.

**Quick-prompts palette.** Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) or click the lightning bolt button injected into the comment toolbar to open a searchable palette of `@opentask` directives plus editable templates. Select one to insert it at the caret.

**Private-repo support.** Optionally configure a fine-grained GitHub personal access token (Contents: read) on the Options page to list skills in private repositories.

**Privacy-first.** No backend, no telemetry, no analytics. All data stays in your browser's local storage. The only network call is a single GitHub API request to list a repo's skills.

## Screenshots

Capture these screenshots at 1280x800 on a GitHub issue or PR page:

1. **Skill dropdown** - Focus a comment textarea, type `!`, and show the fuzzy-filtered skill dropdown with keyboard navigation visible.
2. **Quick-prompts palette** - Open the palette (Ctrl+Shift+P) showing the searchable list of bot directives.
3. **Options page** - The extension options page showing the token field and editable quick prompts list.

## Reviewer instructions

1. Open any GitHub issue or pull request (e.g. https://github.com/octocat/Hello-World/issues/1).
2. Focus the comment textarea and type `!` - a dropdown of repo skills should appear below the caret. Arrow keys navigate, Tab/Enter inserts, Esc closes.
3. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) - the quick-prompts palette should open as a centered overlay. Type to filter, Enter to insert.
4. Click the lightning bolt button in the comment toolbar - the same palette opens.
5. Right-click the extension icon -> Options (or chrome://extensions -> Details -> Extension options). The options page shows a token field and an editable quick-prompts JSON editor with a Reset to defaults button.
6. Verify the extension only requests `storage` permission, `host_permissions` limited to `https://api.github.com/*`, and a content-script match on `https://github.com/*`.

## URLs for the listing

- **Homepage URL**: https://github.com/inference-gateway/opentask
- **Privacy policy URL**: https://github.com/inference-gateway/opentask/blob/main/PRIVACY.md
- **Support URL**: https://github.com/inference-gateway/opentask/issues
