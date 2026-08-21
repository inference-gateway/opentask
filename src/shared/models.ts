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

// Every provider infer-action accepts an api-key for, mirrored from the org's reusable
// workflow (inference-gateway/.github -> .github/workflows/infer.yml). All are wired into
// the generated workflow so any model authenticates once its secret exists; missing
// secrets render blank and are ignored by the action.
export type Provider = { keyInput: string; secret: string };
export const DEFAULT_PROVIDERS: Provider[] = [
  { keyInput: "anthropic-api-key", secret: "ANTHROPIC_API_KEY" },
  { keyInput: "openai-api-key", secret: "OPENAI_API_KEY" },
  { keyInput: "google-api-key", secret: "GOOGLE_API_KEY" },
  { keyInput: "deepseek-api-key", secret: "DEEPSEEK_API_KEY" },
  { keyInput: "groq-api-key", secret: "GROQ_API_KEY" },
  { keyInput: "mistral-api-key", secret: "MISTRAL_API_KEY" },
  { keyInput: "cloudflare-api-key", secret: "CLOUDFLARE_API_KEY" },
  { keyInput: "cohere-api-key", secret: "COHERE_API_KEY" },
  { keyInput: "ollama-cloud-api-key", secret: "OLLAMA_CLOUD_API_KEY" },
  { keyInput: "moonshot-api-key", secret: "MOONSHOT_API_KEY" },
  { keyInput: "minimax-api-key", secret: "MINIMAX_API_KEY" },
  { keyInput: "nvidia-api-key", secret: "NVIDIA_API_KEY" },
  { keyInput: "zai-api-key", secret: "ZAI_API_KEY" },
];

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
export type DependenciesConfig = { autoDetect: boolean; items: PluginOption[]; customSteps: string; apt: string };

export const DEFAULT_DEPENDENCIES: DependenciesConfig = {
  autoDetect: false,
  customSteps: "",
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
    typeof (x as Record<string, unknown>).customSteps === "string" &&
    ["string", "undefined"].includes(typeof (x as Record<string, unknown>).apt) &&
    Array.isArray((x as Record<string, unknown>).items) &&
    ((x as { items: unknown[] }).items).every(isPluginOption)
  );
}

// Maps GitHub /languages API names (from the repo's language breakdown) to dependency
// ids, for auto-detect at workflow-install time.
const GITHUB_LANG_TO_ID: Record<string, string> = {
  Go: "go",
  Rust: "rust",
  JavaScript: "node",
  TypeScript: "node",
  Python: "python",
};

// Auto-detect resolution: returns a copy of `deps` with each language toggle set from
// the repo's GitHub languages. A no-op unless autoDetect is on. Feeding the resolved
// config to workflowYaml keeps YAML generation a single code path.
export function resolveAutoDetect(deps: DependenciesConfig, repoLanguages: string[]): DependenciesConfig {
  if (!deps.autoDetect) return deps;
  const detected = new Set(repoLanguages.map((l) => GITHUB_LANG_TO_ID[l]).filter(Boolean));
  return {
    ...deps,
    items: deps.items.map((d) =>
      DEPENDENCY_DEFS.find((def) => def.id === d.id)?.lang ? { ...d, enabled: detected.has(d.id) } : d,
    ),
  };
}

// The setup-step YAML block to insert between checkout and infer-action: only deps
// with a rendered `step` (task), plus any raw custom steps.
export function dependencySteps(deps: DependenciesConfig): string {
  const on = new Set(deps.items.filter((d) => d.enabled).map((d) => d.id));
  const steps = DEPENDENCY_DEFS.flatMap((def) => (def.step && on.has(def.id) ? [def.step] : []));
  if (deps.customSteps) steps.push(deps.customSteps);
  return steps.join("\n\n");
}

// The `languages:` input value for infer-action: enabled language runtimes, space-separated.
export function dependencyLanguages(deps: DependenciesConfig): string {
  const on = new Set(deps.items.filter((d) => d.enabled).map((d) => d.id));
  return DEPENDENCY_DEFS.flatMap((def) => (def.lang && on.has(def.id) ? [def.lang] : [])).join(" ");
}

// The bash-allow-append entries for every enabled dependency, in render order.
export function dependencyAllowEntries(deps: DependenciesConfig): string[] {
  const on = new Set(deps.items.filter((d) => d.enabled).map((d) => d.id));
  return DEPENDENCY_DEFS.flatMap((def) => (def.allow && on.has(def.id) ? def.allow : []));
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

// Canonical infer-action issue-agent.yml, pinned to a release. The model is a
// workflow_dispatch choice input (options = the configured models, default = the
// one picked at install); every provider's key is wired so any dropdown choice
// authenticates. Missing secrets render blank and are ignored by the action.
export function workflowYaml(models: ModelOption[], defaultModel: string, bot: BotConfig, perms: Permissions = DEFAULT_PERMISSIONS, plugins: string[] = enabledPlugins(DEFAULT_PLUGINS), agents: string[] = [], timeoutMinutes: number = DEFAULT_TIMEOUT, instructions: string = DEFAULT_INSTRUCTIONS, deps: DependenciesConfig = DEFAULT_DEPENDENCIES, debug: boolean = false, visionModel: string = "", imageModel: string = "", reviewInline: boolean = false): string {
  const def = models.some((m) => m.model === defaultModel) ? defaultModel : models[0]?.model ?? "";

  const appends: string[] = [
    "gh project list( .*)?", "gh project field-list( .*)?",
    "gh project item-add( .*)?", "gh project item-edit( .*)?",
  ];
  if (perms.createIssues) appends.push("gh issue create( .*)?", "gh issue edit( .*)?");
  if (perms.comment) appends.push("gh issue comment( .*)?", "gh pr comment( .*)?");
  appends.push(...dependencyAllowEntries(deps));
  const instrBlock = instructions.trim()
    ? `\n          custom-instructions: |\n${instructions.split("\n").map((l) => `            ${l}`).join("\n")}`
    : "";
  const permLines =
    `          enable-git-operations: "\${{ inputs.enable_git || '${perms.createPRs}' }}"` +
    `\n          bash-allow-append: "${appends.join(",")}"` +
    instrBlock +
    (visionModel.trim() ? `\n          vision-model: \${{ inputs.vision-model || '${visionModel.trim()}' }}` : "") +
    (imageModel.trim() ? `\n          image-model: \${{ inputs.image-model || '${imageModel.trim()}' }}` : "");

  const pluginLines = plugins.length ? `\n          plugins: |\n${plugins.map((p) => `            ${p}`).join("\n")}` : "";
  const agentLines = agents.length ? `\n          agents: \${{ inputs.agents || '${agents.join(",")}' }}` : "";

  const providers: Provider[] = [...DEFAULT_PROVIDERS];
  const seen = new Set(providers.map((p) => p.keyInput));
  for (const m of models) {
    if (!seen.has(m.keyInput)) {
      seen.add(m.keyInput);
      providers.push({ keyInput: m.keyInput, secret: m.secret });
    }
  }
  const keyLines = [
    `          llamacpp-api-url: \${{ secrets.LLAMACPP_API_URL }}`,
    `          llamacpp-api-key: \${{ secrets.LLAMACPP_API_KEY }}`,
    ...providers.map((p) => `          ${p.keyInput}: \${{ secrets.${p.secret} }}`),
  ].join("\n");

  const appTokenStep = bot.enabled
    ? `      - uses: actions/create-github-app-token@v3.2.0
        id: app-token
        with:
          client-id: \${{ secrets.${bot.clientId} }}
          private-key: \${{ secrets.${bot.privateKeySecret} }}

`
    : "";
  const checkoutStep = bot.enabled
    ? `      - uses: actions/checkout@v7.0.1
        with:
          token: \${{ steps.app-token.outputs.token }}`
    : `      - uses: actions/checkout@v7.0.1`;
  const depBlock = dependencySteps(deps);
  const depSteps = depBlock ? `\n\n${depBlock}` : "";
  const langs = dependencyLanguages(deps);
  const langLines =
    (langs ? `\n          languages: ${langs}` : "") +
    (deps.apt?.trim() ? `\n          apt: ${deps.apt.trim()}` : "");
  const githubToken = bot.enabled ? "${{ steps.app-token.outputs.token }}" : "${{ secrets.GITHUB_TOKEN }}";
  const botSlugLine = bot.enabled ? "\n          github-app-slug: ${{ steps.app-token.outputs.app-slug }}" : "";

  return `name: Task

on:
  workflow_dispatch:
    inputs:
      model:
        description: Model to use (provider/model, e.g. llamacpp/phi-4)
        required: false
        default: ${def}
      prompt:
        description: Task for the agent (workflow_dispatch only)
        required: false
        default: ""
      enable_git:
        description: Enable git operations - branch, commit, PR (workflow_dispatch only)
        required: false
        default: "${perms.createPRs}"
      system_prompt:
        description: Override the direct-prompt system prompt (workflow_dispatch only)
        required: false
        default: ""
      vision-model:
        description: Vision model for image analysis (workflow_dispatch only)
        required: false
        default: ${visionModel.trim() || '""'}
      image-model:
        description: Image generation model (workflow_dispatch only)
        required: false
        default: ${imageModel.trim() || '""'}
      agents:
        description: A2A agents to spin up (comma-separated, workflow_dispatch only)
        required: false
        default: ""
  issues:
    types:
      - opened
      - edited
  issue_comment:
    types:
      - created
  pull_request_review_comment:
    types:
      - created

permissions:
  issues: write
  contents: write
  pull-requests: write

jobs:
  opentask:
    runs-on: ubuntu-24.04
    timeout-minutes: ${timeoutMinutes}
    steps:
${appTokenStep}${checkoutStep}${depSteps}

      - uses: inference-gateway/infer-action@v0.49.2
        with:
          debug: ${debug}${reviewInline ? `\n          review-inline: "true"` : ""}
          github-token: ${githubToken}${botSlugLine}
          trigger-phrase: "@opentask"
          model: \${{ inputs.model || vars.DEFAULT_MODEL || '${def}' }}
          direct-prompt: \${{ inputs.prompt }}
          system-prompt-direct: \${{ inputs.system_prompt }}${langLines}
${permLines}${pluginLines}${agentLines}
${keyLines}
`;
}

export function prBody(models: ModelOption[], defaultModel: string, bot: BotConfig, plugins: string[] = enabledPlugins(DEFAULT_PLUGINS), agents: string[] = []): string {
  const def = models.some((m) => m.model === defaultModel) ? defaultModel : models[0]?.model ?? "";
  const secretList = [...new Set(models.map((m) => m.secret))].map((s) => `\`${s}\``).join(", ");
  const botStep = bot.enabled
    ? `\n2. Add the \`${bot.privateKeySecret}\` secret with your GitHub App's private key. The workflow authenticates as your App via [actions/create-github-app-token](https://github.com/actions/create-github-app-token), so its comments and commits are attributed to the App.`
    : "";

  const pluginSection = plugins.length
    ? `\n\n### Plugins

The workflow pre-installs the following infer-action plugins to extend the agent's capabilities:

${plugins.map((p) => `- \`${p}\``).join("\n")}`
    : "";

  const agentSection = agents.length
    ? `\n\n### Agents

The workflow spins up the following A2A agents from the [agents registry](https://github.com/inference-gateway/agents) and exposes them to the OpenTask agent:

${agents.map((a) => `- \`${a}\``).join("\n")}`
    : "";

  return `## OpenTask Agent workflow

This PR adds the OpenTask Agent workflow to this repository. It uses [inference-gateway/infer-action](https://github.com/inference-gateway/infer-action) to run the OpenTask agent on issues and pull requests. The model is a workflow input (dropdown), defaulting to \`${def}\`.

### Setup

Before the workflow can run:

1. Go to Settings > Secrets and variables > Actions and add the provider API key secret for the model(s) you use: ${secretList}.${botStep}

The workflow triggers on new/edited issues, issue comments, and pull request review comments, and can also be run manually (Actions > Task > Run workflow) with a model chosen from the dropdown.

### Self-hosted llama.cpp (RunPod GPU)

To route runs to a self-hosted llama.cpp endpoint (e.g. a GPU provisioned from the OpenTask popup), add to Settings > Secrets and variables > Actions:

- Secret \`LLAMACPP_API_URL\` - the endpoint base URL shown in the popup, e.g. \`https://<pod>-8080.proxy.runpod.net/v1\`.
- Secret \`LLAMACPP_API_KEY\` - the bearer token shown in the popup (the pod is started with \`--api-key\`).
- (Optional) Variable \`DEFAULT_MODEL\` - overrides the default model for issue/comment-triggered runs, e.g. \`llamacpp/<model>\`. Manual/dispatch runs still use the picker.

### Project board tracking

When an issue it works on is on a GitHub project board, the agent keeps the board's Status in sync (In Progress on start, QA right after the PR is opened - never set 'Done'), best-effort. Board writes require a token with **Projects** permission: the default \`GITHUB_TOKEN\` cannot access Projects v2, so enable the GitHub App option (with Projects: read and write) for this to take effect${bot.enabled ? " - your App must grant it" : ""}. Without it the agent skips board updates silently and does the rest of its work normally.${pluginSection}${agentSection}
`;
}
