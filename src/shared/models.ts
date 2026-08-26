// Install-workflow config, shared by the popup (model dropdown) and background
// (generated workflow). Each ModelOption maps a provider-prefixed model id to the
// inference-gateway/infer-action provider-key input and the repo secret it reads.
// A BotConfig optionally makes the workflow authenticate as a GitHub App. All of
// this is editable in the options page.
export type ModelOption = { model: string; keyInput: string; secret: string };

// Curated from infer-action's README supported-model list. First entry = default.
export const DEFAULT_MODELS: ModelOption[] = [
  { model: "ollama_cloud/deepseek-v4-flash:preview", keyInput: "ollama-cloud-api-key", secret: "OLLAMA_CLOUD_API_KEY" },
  { model: "deepseek/deepseek-v4-flash", keyInput: "deepseek-api-key", secret: "DEEPSEEK_API_KEY" },
  { model: "anthropic/claude-sonnet-4-6", keyInput: "anthropic-api-key", secret: "ANTHROPIC_API_KEY" },
  { model: "openai/gpt-5", keyInput: "openai-api-key", secret: "OPENAI_API_KEY" },
  { model: "google/gemini-3-pro", keyInput: "google-api-key", secret: "GOOGLE_API_KEY" },
  { model: "moonshot/kimi-k2", keyInput: "moonshot-api-key", secret: "MOONSHOT_API_KEY" },
];

export function isModelOption(m: unknown): m is ModelOption {
  return (
    !!m &&
    typeof m === "object" &&
    ["model", "keyInput", "secret"].every((k) => typeof (m as Record<string, unknown>)[k] === "string")
  );
}

// Optional GitHub App identity. When enabled, the workflow mints an installation
// token via actions/create-github-app-token and acts as the App, so the agent's
// runtime comments and commits are attributed to (and signed for) the App.
export type BotConfig = { enabled: boolean; clientId: string; privateKeySecret: string };

export const DEFAULT_BOT: BotConfig = { enabled: false, clientId: "", privateKeySecret: "OPENTASK_APP_PRIVATE_KEY" };

export function isBotConfig(b: unknown): b is BotConfig {
  return (
    !!b &&
    typeof b === "object" &&
    typeof (b as Record<string, unknown>).enabled === "boolean" &&
    typeof (b as Record<string, unknown>).clientId === "string" &&
    typeof (b as Record<string, unknown>).privateKeySecret === "string"
  );
}

// Prefills GitHub's App-creation form for an owner via query params on the plain GET
// flow (settings/apps/new). This reliably sets the required Homepage (url) and unchecks
// the webhook (webhook_active=false) - the manifest POST flow can't be submitted from an
// extension origin. A non-blank owner targets that org's settings; blank = personal.
export function githubAppUrl(owner: string, isOrg: boolean): string {
  const base = owner && isOrg
    ? `https://github.com/organizations/${owner}/settings/apps/new`
    : "https://github.com/settings/apps/new";
  const params = new URLSearchParams({
    name: owner ? `OpenTask ${owner}` : "OpenTask Agent",
    description: "OpenTask agent bot",
    url: owner ? `https://github.com/${owner}` : "https://github.com/inference-gateway/opentask",
    public: "false",
    webhook_active: "false",
    contents: "write",
    issues: "write",
    pull_requests: "write",
    actions: "write",
    workflows: "write",
  });
  return `${base}?${params}`;
}

// What the agent may do at runtime. infer-action gives the agent a read-only bash baseline;
// these map to the two inputs that widen it: git writes + `gh pr create` are gated by
// enable-git-operations, and other writes (issue create, comments) must be appended to the
// allow-list via bash-allow-append. All default on; unchecking one drops that capability.
export type Permissions = { createPRs: boolean; createIssues: boolean; comment: boolean };
export const DEFAULT_PERMISSIONS: Permissions = { createPRs: true, createIssues: true, comment: true };

export function isPermissions(p: unknown): p is Permissions {
  return (
    !!p &&
    typeof p === "object" &&
    ["createPRs", "createIssues", "comment"].every((k) => typeof (p as Record<string, unknown>)[k] === "boolean")
  );
}

// Issue refinement: `manual` shows a Refine button in the issue header; `auto` dispatches a
// refine run when the user creates a new issue via GitHub's native form. Stored under "refine".
export type RefineConfig = { auto: boolean; manual: boolean };
export const DEFAULT_REFINE: RefineConfig = { auto: false, manual: true };

// The infer-action plugins the extension knows about. Each is installed via
// `infer plugins install --yes` before the agent runs. Disabled by default; a user opts
// in per-plugin in options, and only enabled ids get baked into the generated workflow.
export type PluginOption = { id: string; enabled: boolean };
export const DEFAULT_PLUGINS: PluginOption[] = [
  { id: "juliusbrussee/caveman", enabled: false },
  { id: "DietrichGebert/ponytail", enabled: false },
  { id: "ayghri/i-have-adhd", enabled: false },
];

export function isPluginOption(p: unknown): p is PluginOption {
  return (
    !!p &&
    typeof p === "object" &&
    typeof (p as Record<string, unknown>).id === "string" &&
    typeof (p as Record<string, unknown>).enabled === "boolean"
  );
}

// ids of the plugins toggled on - what actually gets baked into the workflow.
export const enabledPlugins = (plugins: PluginOption[]): string[] =>
  plugins.filter((p) => p.enabled).map((p) => p.id);

// Common CI dependencies for the generated workflow. Language toolchains are installed
// by infer-action itself via its `languages:` input; only `task` remains a real setup
// step (not covered by `languages`). `autoDetect` (default off) ignores the language
// toggles and instead resolves the list at install time from the repo's GitHub
// languages API. `apt` is a space-separated package list for infer-action's `apt:`
// input. Stored under "dependencies", reusing PluginOption's {id, enabled} shape.
export type DependenciesConfig = { autoDetect: boolean; items: PluginOption[]; apt: string };

export const DEFAULT_DEPENDENCIES: DependenciesConfig = {
  autoDetect: false,
  apt: "",
  items: [
    { id: "task", enabled: true },
    { id: "go", enabled: false },
    { id: "rust", enabled: false },
    { id: "node", enabled: false },
    { id: "python", enabled: false },
  ],
};

// Registry of dependency toggles. Language runtimes carry a `lang` id passed to
// infer-action's `languages:` input (the action installs the toolchain, respecting
// version files like go.mod/.nvmrc); `task` keeps a rendered setup step (6-space indent
// for `- uses:`, matching checkoutStep) since `languages` does not cover go-task.
// `allow` lists the bash-allow-append entries (Go regexes, anchored by the CLI matcher)
// granted alongside the toolchain - infer-action does NOT auto-append these, and an
// installed toolchain the agent cannot invoke leaves it hand-simulating the tool.
// `task` needs none: it is already in the Infer CLI's read-only bash baseline.
export const DEPENDENCY_DEFS: { id: string; label: string; step?: string; lang?: string; allow?: string[] }[] = [
  { id: "task", label: "Task (go-task)", step: `      - uses: arduino/setup-task@v3.0.0\n        with:\n          version: 3.x\n          repo-token: \${{ secrets.GITHUB_TOKEN }}` },
  { id: "go", label: "Go", lang: "go", allow: ["gofmt( .*)?", "go (fmt|vet|test|build|run|mod|generate|tool)( .*)?"] },
  { id: "rust", label: "Rust", lang: "rust", allow: ["cargo( .*)?", "rustfmt( .*)?", "rustc( .*)?", "rustup( .*)?"] },
  { id: "node", label: "Node.js / TypeScript", lang: "node", allow: ["npm( .*)?", "npx( .*)?", "yarn( .*)?", "pnpm( .*)?", "bun( .*)?", "bunx( .*)?"] },
  { id: "python", label: "Python", lang: "python", allow: ["python3?( .*)?", "pip3?( .*)?", "pytest( .*)?", "ruff( .*)?", "uv( .*)?"] },
];

export function isDependenciesConfig(x: unknown): x is DependenciesConfig {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as Record<string, unknown>).autoDetect === "boolean" &&
    ["string", "undefined"].includes(typeof (x as Record<string, unknown>).apt) &&
    Array.isArray((x as Record<string, unknown>).items) &&
    ((x as { items: unknown[] }).items).every(isPluginOption)
  );
}

export function isRefineConfig(r: unknown): r is RefineConfig {
  return (
    !!r &&
    typeof r === "object" &&
    ["auto", "manual"].every((k) => typeof (r as Record<string, unknown>)[k] === "boolean")
  );
}

// Project init: what the Init button asks the agent to scaffold. AGENTS.md is always
// generated; the toggles add optional extras. All default off. Stored under "init".
export type InitConfig = { githooks: boolean; claudeSymlink: boolean; skillsSymlink: boolean };
export const DEFAULT_INIT: InitConfig = { githooks: false, claudeSymlink: false, skillsSymlink: false };

export function isInitConfig(x: unknown): x is InitConfig {
  return (
    !!x &&
    typeof x === "object" &&
    ["githooks", "claudeSymlink", "skillsSymlink"].every((k) => typeof (x as Record<string, unknown>)[k] === "boolean")
  );
}

// Per-run job timeout (minutes) for the generated workflow. Stored under "timeout".
export const DEFAULT_TIMEOUT = 25;
export function normalizeTimeout(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) && x > 0 ? Math.round(x) : DEFAULT_TIMEOUT;
}

// Generic, board-agnostic project-board tracking, appended to the agent's instructions.
// No hardcoded project/field/option ids: the agent discovers the board and its Status
// field at runtime, so this works on any repo/org, not just one specific board. Best-effort
// throughout - a missing Status field or a Projects-permission failure is logged, never fatal.
export const DEFAULT_INSTRUCTIONS = `When working on a GitHub issue that belongs to a project board, keep the board's status in
sync as you go. This is best-effort: on any error (no board, no Status field, missing
Projects permission, network failure) log it and carry on - never abort the task over a
board update.

Detect membership from the ISSUE side, never by scanning the board - a board can hold
thousands of items and \`gh project item-list\` only fetches 30 by default, so scanning
misses the issue and does not scale:

- \`gh issue view <number> --json projectItems\` lists the boards this issue is on (and its
  current Status), in one call regardless of board size. Empty list means it is on no
  board - do nothing further.
- For each board it is on, resolve the project number + id and the Status single-select
  field (with its option ids) via \`gh project list --owner <owner> --format json\` and
  \`gh project field-list <number> --owner <owner> --format json\`. No "Status" (or close
  equivalent) field: log a warning and skip that board.
- Get the item id idempotently with \`gh project item-add <number> --owner <owner> --url
  <issue-url> --format json\` - it returns the existing item's id in O(1). Do NOT list
  items to find it.
- Set Status with \`gh project item-edit --id <item-id> --project-id <project-id>
  --field-id <field-id> --single-select-option-id <option-id>\`: the option closest to
  "In Progress" BEFORE you start changing anything, and the option closest to "QA" right
  after the pull request is opened (fall back to "Done" only when no QA-like option
  exists). Never set "Done" - that happens at merge.`;

