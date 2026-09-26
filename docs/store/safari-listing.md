# Safari Web Extension Packaging & Release Guide

This document describes how to convert the shared Chrome `dist/` bundle into a
Safari Web Extension, configure the Xcode project, test on macOS and iOS, and
submit to the Mac App Store and iOS App Store.

The extension uses **no separate Safari implementation** - the same `dist/`
bundle built by `task build:safari` is wrapped by Apple's
`safari-web-extension-converter` into a native Xcode project. Only the manifest
is Safari-specific: `build.ts` shallow-merges `manifest.safari.json` over
`manifest.json`, which adds `browser_specific_settings.safari` and replaces
`permissions` with the narrower Safari set (`storage`, `activeTab`, `tabs`,
`scripting`, `alarms` - no `sidePanel` or `notifications`), then deletes the
`side_panel` key. The side panel (and the CLI-bridge chat UI it hosts) is not
part of the Safari build.

---

## Prerequisites

- **macOS 13.5+** (Ventura or later) with **Xcode 15+** installed
- An **Apple Developer account** enrolled in the
  [Apple Developer Program](https://developer.apple.com/programs/) (US$99/year)
- The `dist/` directory built for Safari:

  ```bash
  task build:safari
  ```

  This produces `dist/` with the Safari manifest override applied.

---

## Step 1: Convert the Chrome extension to a Safari Xcode project

Run Apple's converter tool on the `dist/` directory:

```bash
xcrun safari-web-extension-converter dist/ \
  --bundle-identifier com.inferencegateway.browser-extension \
  --project-location ../safari-extension \
  --no-open
```

| Flag | Purpose |
| --- | --- |
| `--bundle-identifier` | Your reverse-domain bundle ID. Must be unique across all your apps. |
| `--project-location` | Where to write the Xcode project (outside this repo). |
| `--no-open` | Don't open Xcode immediately - useful when scripting. Omit to open Xcode right away. |

The converter creates:

```
safari-extension/
├── iOS (App)/
│   ├── iOSViewController.swift
│   └── Info.plist
├── macOS (App)/
│   ├── macOSViewController.swift
│   ├── SafariWebExtensionHandler.swift
│   └── Info.plist
├── Shared (Extension)/
│   ├── Resources/
│   │   ├── manifest.json        # converted from dist/
│   │   ├── background.js         # copied from dist/
│   │   ├── content.js           # copied from dist/
│   │   ├── options.js           # copied from dist/
│   │   ├── popup.js             # copied from dist/
│   │   ├── sidepanel.js         # copied from dist/
│   │   ├── options.html         # copied from dist/
│   │   ├── popup.html           # copied from dist/
│   │   ├── sidepanel.html       # copied from dist/
│   │   ├── options.css          # Tailwind output from build.ts
│   │   ├── styles.css           # copied from dist/
│   │   └── icons/               # copied from dist/
│   └── safari-web-extension.swift
├── Safari-Web-Extension.xcodeproj
└── safari-extension-SwiftUI (optional, can be deleted)
```

> **Note:** The converter copies the files - it does not symlink. When you
> rebuild `dist/`, you must re-run the converter or manually copy updated files
> into the Xcode project's `Shared (Extension)/Resources/` directory.

---

## Step 2: Configure the Xcode project

### Bundle identifier

Open the project in Xcode and verify the bundle identifier:

- **macOS target**: `com.inferencegateway.browser-extension.mac`
- **iOS target**: `com.inferencegateway.browser-extension.ios`
- **Shared Extension target**: `com.inferencegateway.browser-extension`

These are set automatically by the converter from the `--bundle-identifier` flag.

### Signing & Capabilities

1. In Xcode, select the project navigator → the top-level project.
2. Select each target (macOS, iOS, Shared Extension) and go to
   **Signing & Capabilities**.
3. Choose your **Team** from the dropdown.
4. Xcode will manage signing automatically with your development certificate.
5. For distribution, switch to **"Any Apple Silicon Mac"** (macOS) and
   **"Any iOS Device"** (iOS) and use an **App Store Connect** signing
   certificate.

### Minimum deployment targets

| Target | Recommended minimum |
| --- | --- |
| macOS app | macOS 13.0 (Ventura) |
| iOS app | iOS 16.4 |
| Shared Extension | macOS 13.0 / iOS 16.4 |

These match Safari's Web Extension support baseline. Safari 16.4+ is required
for full MV3 compatibility.

---

## Step 3: Test on macOS Safari

1. In Xcode, select the **macOS** scheme and a **My Mac** destination.
2. Build and run (⌘R). Safari opens with the extension installed and enabled.
3. Navigate to any GitHub issue or PR and verify:
   - Typing `!` opens the skill dropdown
   - `Ctrl+Shift+P` (or `Cmd+Shift+P`) opens the quick-prompts palette
   - The lightning bolt button appears in the comment toolbar
   - Settings persist across Safari restarts (Options page)
4. Check Safari → Settings → Extensions to see the extension listed.

### Debugging

- Use Safari's **Develop → Web Extension Background Page** to inspect the
  background page console.
- Use **Develop → Show Web Inspector** on the GitHub page to inspect content
  script output.
- Enable **Develop → Experimental Features → Web Inspector Extensions** for
  full extension debugging support.

---

## Step 4: Test on iOS Safari

1. Connect a physical iOS device (the iOS simulator does not support Web
   Extensions).
2. In Xcode, select the **iOS** scheme and your device.
3. Build and run (⌘R). The Safari extension settings appear in
   **Settings → Safari → Extensions**.
4. Enable the extension and test on GitHub in Safari.

> **Note:** iOS Safari Web Extensions run only on the **active tab** and have
> limited background execution. The extension's service worker may be suspended
> more aggressively than on desktop. The skill cache TTL (10 minutes) and
> `chrome.storage.local` persistence work identically.

---

## Step 5: Prepare for App Store submission

### macOS App Store

1. In Xcode, select the **macOS** scheme.
2. Choose **Product → Archive**.
3. In the Organizer window, select the archive and click **Distribute App**.
4. Choose **App Store Connect** → **Upload**.
5. Sign with your distribution certificate and upload.
6. In [App Store Connect](https://appstoreconnect.apple.com), create a new
   **macOS App** entry:
   - **Bundle ID**: `com.inferencegateway.browser-extension.mac`
   - **SKU**: `OPENTASK_MAC_001`
   - **Review information**: See [Store listing assets](#store-listing-assets)
     below.
7. The extension's functionality is reviewed as part of the app - there is no
   separate Safari extension review.

### iOS App Store

1. In Xcode, select the **iOS** scheme.
2. Choose **Product → Archive**.
3. Distribute via **App Store Connect** → **Upload**.
4. In App Store Connect, create a new **iOS App** entry:
   - **Bundle ID**: `com.inferencegateway.browser-extension.ios`
   - **SKU**: `OPENTASK_IOS_001`

### Version alignment

Keep the Safari extension version in sync with the Chrome/Edge/Firefox releases.
The version is read from `manifest.json` in `Shared (Extension)/Resources/`.
Never bump the version by hand - semantic-release writes each release version
into `manifest.json` and `package.json` (the `@semantic-release/exec` prepare
step in `.releaserc.yaml`). To update the Safari build after a release:

1. Check out the release tag (e.g. `git checkout v1.16.0`).
2. Build with `task build:safari` - `build.ts` shallow-merges
   `manifest.safari.json` over `manifest.json`, so the merged manifest already
   carries the released version.
3. Re-run the converter or copy the updated `manifest.json` into the Xcode
   project.
4. Update the Xcode project's marketing version to match.

---

## Store listing assets

### Short description (132 chars max)

Repo-skill tab-completion, quick-prompts, and browser-use automation for AI coding agents.

### Full description

OpenTask adds these productivity tools to GitHub's comment boxes, repository navigation, and side panel:

**Skill tab-completion.** Type `!` in a comment box to open a keyboard-navigable dropdown of the current repository's skills (fetched from `.agents/skills/` via the GitHub Contents API). Filter as you type with fuzzy matching. Press Tab or Enter to insert `/skill-name` at the caret.

**Quick-prompts palette.** Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) or click the lightning bolt button injected into the comment toolbar to open a searchable palette of `@opentask` directives plus editable templates. Select one to insert it at the caret.

**Repo-nav panels.** Tasks, Skills, and Init items added to GitHub's repository navigation: install the OpenTask agent workflow in the repo, browse a repository's skills, and initialize the OpenTask setup.

**Issue Refine.** A Refine button on issue pages sends the issue to the agent, which rewrites its description in place.

**Browser-use bridge.** Pairs with a local `infer` CLI over a localhost WebSocket so your agent can drive browser automation - navigating tabs, extracting content, capturing screenshots - with your approval. (The side panel UI itself is Chrome-only.)

**Self-hosted GPU models (optional).** Provision a RunPod GPU pod that serves a llama.cpp OpenAI-compatible endpoint, using your own RunPod API key and the RunPod REST API.

**Privacy-first.** No telemetry, no analytics, and no backend of our own; settings stay in your browser's local storage. Network calls go to: the local CLI bridge over localhost (GitHub API requests run through `gh` on the CLI host, so the extension never holds a GitHub token), the agents catalog on jsdelivr, and - only when you configure them - the RunPod REST API for GPU provisioning and the sites your agent automates from the bridge (the reason for the broad host permissions).

### Screenshots

Capture these screenshots at the recommended resolution for each platform:

- **macOS**: 2880×1800 (or 1280×800 for Retina-downscaled)
- **iOS**: iPhone 15 Pro Max (1290×2796) or iPad Pro (2048×2732)

1. **Skill dropdown** - Focus a comment textarea on a GitHub issue, type `!`, and show the fuzzy-filtered skill dropdown with keyboard navigation visible.
2. **Quick-prompts palette** - Open the palette (Ctrl+Shift+P) showing the searchable list of bot directives.
3. **Options page** - The extension options page showing the Orchestrator, Agents, Prompts, Workflows, Dependencies, and Appearance tabs; capture the Prompts tab with the editable quick-prompts JSON editor.

### Reviewer instructions

1. Open any GitHub issue or pull request (e.g. https://github.com/octocat/Hello-World/issues/1).
2. Focus the comment textarea and type `!` - a dropdown of repo skills should appear below the caret. Arrow keys navigate, Tab/Enter inserts, Esc closes.
3. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) - the quick-prompts palette should open as a centered overlay. Type to filter, Enter to insert.
4. Click the lightning bolt button in the comment toolbar - the same palette opens.
5. Right-click the extension icon → Preferences (or Safari → Settings → Extensions → OpenTask → Preferences). The options page opens on the Workflows tab with tabs for Orchestrator, Agents, Prompts, Workflows, Dependencies, and Appearance. The editable quick-prompts JSON editor is under Prompts; Save and Reset to defaults buttons sit at the bottom of the page.
6. Verify the manifest requests `storage`, `activeTab`, `tabs`, `scripting`, and `alarms` (settings, browser-use automation from the CLI bridge, and bridge reconnection; the Safari build has no side panel), with the shared host permissions `https://api.github.com/*` (GitHub API access via the CLI's `gh`), `https://rest.runpod.io/*` (optional GPU provisioning), and `http://*/*`, `https://*/*`, `<all_urls>` (the tabs your agent automates); and a content-script match on `https://github.com/*`.

### URLs for the listing

- **Homepage URL**: https://github.com/inference-gateway/opentask
- **Privacy policy URL**: https://github.com/inference-gateway/opentask/blob/main/PRIVACY.md
- **Support URL**: https://github.com/inference-gateway/opentask/issues
- **Marketing URL**: https://github.com/inference-gateway/opentask

---

## Updating the Safari extension after a code change

When the shared extension code changes (new release), update the Safari build:

```bash
# 1. Rebuild the shared bundle with Safari manifest
task build:safari

# 2. Re-run the converter (overwrites the Xcode project's Resources)
xcrun safari-web-extension-converter dist/ \
  --bundle-identifier com.inferencegateway.browser-extension \
  --project-location ../safari-extension \
  --no-open

# 3. Open Xcode, update the marketing version, re-archive, and upload
open ../safari-extension/Safari-Web-Extension.xcodeproj
```

> **Tip:** The converter regenerates the entire Xcode project each time. If you
> have custom Xcode build settings (signing team, capabilities), keep a
> separate note of them so you can re-apply them after each conversion.

---

## Known limitations

| Limitation | Details |
| --- | --- |
| **Background service worker** | Safari supports `background.service_worker` from Safari 16.4+. The converter handles the manifest conversion automatically. |
| **`chrome.storage` API** | Safari maps `chrome.storage.local` to `NSUbiquitousKeyValueStore` on iOS (with size limits) and `NSUserDefaults` on macOS. The 10 MB limit applies. |
| **`fetch` in service worker** | Safari suspends the service worker after a few seconds of inactivity. The skill cache (10-minute TTL) mitigates re-fetch overhead. |
| **iOS background execution** | On iOS, the extension's background page may be suspended when Safari is backgrounded. Content script injection works on page load. |
| **No `chrome.action` popup on iOS** | Safari on iOS does not display toolbar popups. The extension's functionality (skill dropdown, palette) works entirely through content script injection. |
| **Converter re-run** | The converter copies files rather than symlinking. Each code update requires re-running the converter and re-applying Xcode settings. |

---

## Troubleshooting

### "safari-web-extension-converter: command not found"

Ensure Xcode command-line tools are installed:

```bash
xcode-select --install
```

### "The bundle identifier is already in use"

Choose a different bundle ID or remove the existing app from App Store Connect
if you are testing with a new identifier.

### Extension not appearing in Safari

1. Ensure the extension is enabled in **Safari → Settings → Extensions**.
2. Check that the Xcode build target matches your macOS version.
3. Restart Safari after building.

### Content script not injecting on GitHub

1. Open Safari's **Develop → Show Web Inspector** on the GitHub page.
2. Check the Console for content script errors.
3. Verify the extension's permissions include `https://github.com/*` in the
   converted `manifest.json` inside `Shared (Extension)/Resources/`.

### "Failed to load extension" on iOS

1. Ensure you are testing on a **physical device** - the iOS simulator does not
   support Web Extensions.
2. Verify the extension is enabled in **Settings → Safari → Extensions**.
3. Check that the device is running iOS 16.4 or later.
