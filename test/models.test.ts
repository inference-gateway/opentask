import { expect, test } from "bun:test";
import { DEFAULT_MODELS, DEFAULT_BOT, DEFAULT_PROVIDERS, DEFAULT_PERMISSIONS, DEFAULT_PLUGINS, DEFAULT_DEPENDENCIES, DEFAULT_TIMEOUT, DEFAULT_INSTRUCTIONS, DEPENDENCY_DEFS, isModelOption, isBotConfig, isPermissions, isPluginOption, isDependenciesConfig, enabledPlugins, githubAppUrl, prBody, workflowYaml, type DependenciesConfig } from "../src/shared/models";

const models = DEFAULT_MODELS;
const def = "anthropic/claude-sonnet-4-6";
const noBot = DEFAULT_BOT;
const bot = { enabled: true, clientId: "Iv23liABC", privateKeySecret: "OPENTASK_APP_PRIVATE_KEY" };

test("githubAppUrl uses the org path only for an org owner, personal path otherwise", () => {
  expect(githubAppUrl("acme", true).startsWith("https://github.com/organizations/acme/settings/apps/new?")).toBe(true);
  expect(githubAppUrl("edenreich", false).startsWith("https://github.com/settings/apps/new?")).toBe(true);
  expect(githubAppUrl("", false).startsWith("https://github.com/settings/apps/new?")).toBe(true);
});

test("githubAppUrl disables the webhook and sets a Homepage url", () => {
  const p = new URL(githubAppUrl("acme", true)).searchParams;
  expect(p.get("webhook_active")).toBe("false");
  expect(p.get("url")).toBe("https://github.com/acme");
  expect(new URL(githubAppUrl("", false)).searchParams.get("url")).toBeTruthy();
});

test("workflowYaml uses block-list syntax, not inline arrays", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("types:\n      - created");
  expect(yaml).not.toContain("[created]");
  expect(yaml).not.toContain("[opened");
});

test("workflowYaml emits selected agents as a comma-separated input fallback, and omits the key when none", () => {
  const yaml = workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, [], ["browser-agent", "documentation-agent"]);
  expect(yaml).toContain("          agents: ${{ inputs.agents || 'browser-agent,documentation-agent' }}");
  expect(workflowYaml(models, def, noBot)).not.toContain("          agents:");
});

test("workflowYaml exposes an agents workflow_dispatch input", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("      agents:\n        description: A2A agents to spin up (comma-separated, workflow_dispatch only)");
});

test("workflowYaml pins the checkout and infer-action refs", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("uses: actions/checkout@v7.0.1");
  expect(yaml).toContain("uses: inference-gateway/infer-action@v0.47.0");
});

test("workflowYaml sets the @opentask trigger-phrase", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain('trigger-phrase: "@opentask"');
});

test("workflowYaml exposes model as a free-text workflow_dispatch input with default", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("workflow_dispatch:");
  expect(yaml).not.toContain("type: choice");
  expect(yaml).toContain(`default: ${def}`);
  expect(yaml).toContain(`model: \${{ inputs.model || vars.DEFAULT_MODEL || '${def}' }}`);
});

test("workflowYaml wires the llama.cpp endpoint secret onto infer-action, grouped with the provider keys", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("llamacpp-api-url: ${{ secrets.LLAMACPP_API_URL }}");
  expect(yaml).toContain("llamacpp-api-key: ${{ secrets.LLAMACPP_API_KEY }}");
  expect(yaml.indexOf("llamacpp-api-url:")).toBeGreaterThan(yaml.indexOf("custom-instructions:"));
  expect(yaml.indexOf("anthropic-api-key:")).toBeGreaterThan(yaml.indexOf("llamacpp-api-key:"));
});

test("workflowYaml emits vision-model/image-model inputs always, with: params only when set", () => {
  const off = workflowYaml(models, def, noBot);
  expect(off).toContain("      vision-model:\n        description: Vision model for image analysis (workflow_dispatch only)");
  expect(off).toContain("      image-model:\n        description: Image generation model (workflow_dispatch only)");
  expect(off).not.toContain("          vision-model:");
  expect(off).not.toContain("          image-model:");
  const on = workflowYaml(models, def, noBot, undefined, undefined, undefined, undefined, undefined, undefined, false, "anthropic/claude-haiku-4-5-20251001", "openai/gpt-image-2");
  expect(on).toContain("          vision-model: ${{ inputs.vision-model || 'anthropic/claude-haiku-4-5-20251001' }}");
  expect(on).toContain("          image-model: ${{ inputs.image-model || 'openai/gpt-image-2' }}");
});

test("workflowYaml exposes a prompt input wired to infer-action direct-prompt", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("prompt:\n        description: Task for the agent (workflow_dispatch only)");
  expect(yaml).toContain("direct-prompt: ${{ inputs.prompt }}");
});

test("workflowYaml wires the debug flag onto infer-action, off by default", () => {
  expect(workflowYaml(models, def, noBot)).toContain(`debug: false`);
  expect(workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, [], [], DEFAULT_TIMEOUT, DEFAULT_INSTRUCTIONS, DEFAULT_DEPENDENCIES, true)).toContain(`debug: true`);
});

test("workflowYaml omits review-inline by default, emits when enabled", () => {
  expect(workflowYaml(models, def, noBot)).not.toContain("review-inline:");
  expect(workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, [], [], DEFAULT_TIMEOUT, DEFAULT_INSTRUCTIONS, DEFAULT_DEPENDENCIES, false, "", "", true)).toContain('review-inline: "true"');
});

test("workflowYaml exposes an enable_git input defaulting to the createPRs permission", () => {
  expect(workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS)).toContain('enable_git:\n        description: Enable git operations - branch, commit, PR (workflow_dispatch only)\n        required: false\n        default: "true"');
  expect(workflowYaml(models, def, noBot, { createPRs: false, createIssues: true, comment: true })).toContain('default: "false"');
});

test("workflowYaml exposes a system_prompt input wired to infer-action system-prompt-direct", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("system_prompt:\n        description: Override the direct-prompt system prompt (workflow_dispatch only)");
  expect(yaml).toContain("system-prompt-direct: ${{ inputs.system_prompt }}");
});

test("workflowYaml wires every standard provider key", () => {
  const yaml = workflowYaml(models, def, noBot);
  for (const p of DEFAULT_PROVIDERS) expect(yaml).toContain(`${p.keyInput}: \${{ secrets.${p.secret} }}`);
  expect(DEFAULT_PROVIDERS.length).toBeGreaterThanOrEqual(13);
});

test("workflowYaml appends a custom-model provider key, deduped", () => {
  const custom = [{ model: "acme/rocket-1", keyInput: "acme-api-key", secret: "ACME_API_KEY" }];
  const yaml = workflowYaml(custom, custom[0].model, noBot);
  for (const p of DEFAULT_PROVIDERS) expect(yaml).toContain(`${p.keyInput}: \${{ secrets.${p.secret} }}`);
  expect(yaml).toContain("acme-api-key: ${{ secrets.ACME_API_KEY }}");
  const dup = [
    { model: "anthropic/claude-sonnet-4-6", keyInput: "anthropic-api-key", secret: "ANTHROPIC_API_KEY" },
    { model: "anthropic/claude-haiku-4-5", keyInput: "anthropic-api-key", secret: "ANTHROPIC_API_KEY" },
  ];
  expect(workflowYaml(dup, dup[0].model, noBot).match(/anthropic-api-key:/g)?.length).toBe(1);
});

test("workflowYaml without a bot uses GITHUB_TOKEN and no app-token step", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).not.toContain("create-github-app-token");
  expect(yaml).toContain("github-token: ${{ secrets.GITHUB_TOKEN }}");
  expect(yaml).not.toContain("token: ${{ steps.app-token.outputs.token }}");
});

test("workflowYaml with a bot mints an app token and uses it for checkout + infer-action", () => {
  const yaml = workflowYaml(models, def, bot);
  expect(yaml).toContain("uses: actions/create-github-app-token@v3");
  expect(yaml).toContain(`client-id: \${{ secrets.${bot.clientId} }}`);
  expect(yaml).toContain(`private-key: \${{ secrets.${bot.privateKeySecret} }}`);
  expect(yaml).toContain("token: ${{ steps.app-token.outputs.token }}");
  expect(yaml).toContain("github-token: ${{ steps.app-token.outputs.token }}");
  expect(yaml).not.toContain("github-token: ${{ secrets.GITHUB_TOKEN }}");
  expect(yaml).toContain("github-app-slug: ${{ steps.app-token.outputs.app-slug }}");
});

test("workflowYaml renders a SCREAMING_SNAKE client id as a secrets reference", () => {
  const yaml = workflowYaml(models, def, { ...bot, clientId: "INFERENCE_GATEWAY_APP_CLIENT_ID" });
  expect(yaml).toContain("client-id: ${{ secrets.INFERENCE_GATEWAY_APP_CLIENT_ID }}");
  expect(yaml).not.toContain("client-id: INFERENCE_GATEWAY_APP_CLIENT_ID");
});

test("workflowYaml without a bot does not pass github-app-slug", () => {
  expect(workflowYaml(models, def, noBot)).not.toContain("github-app-slug");
});

test("prBody names the provider secret and, with a bot, the private-key secret", () => {
  const body = prBody(models, def, noBot);
  expect(body).toContain("`ANTHROPIC_API_KEY`");
  expect(body).not.toContain("`OPENTASK_APP_PRIVATE_KEY`");
  expect(prBody(models, def, bot)).toContain("`OPENTASK_APP_PRIVATE_KEY`");
});

test("workflowYaml maps permissions onto infer-action allow-list inputs", () => {
  const all = workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS);
  expect(all).toContain("enable-git-operations: \"${{ inputs.enable_git || 'true' }}\"");
  expect(all).toContain("gh issue create( .*)?");
  expect(all).toContain("gh issue comment( .*)?");
  expect(all).toContain("gh pr comment( .*)?");

  const readonly = workflowYaml(models, def, noBot, { createPRs: false, createIssues: false, comment: false });
  expect(readonly).toContain("enable-git-operations: \"${{ inputs.enable_git || 'false' }}\"");
  expect(readonly).toContain("gh project item-edit( .*)?");
  expect(readonly).not.toContain("gh issue create");
  expect(readonly).not.toContain("gh pr comment");

  const issuesOnly = workflowYaml(models, def, noBot, { createPRs: false, createIssues: true, comment: false });
  expect(issuesOnly).toContain("gh project list( .*)?,gh project field-list( .*)?,gh project item-add( .*)?,gh project item-edit( .*)?,gh issue create( .*)?,gh issue edit( .*)?");
  expect(issuesOnly).not.toContain("gh pr comment");
});

test("workflowYaml injects generic, board-agnostic board-tracking custom-instructions", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("custom-instructions: |");
  expect(yaml).toContain("project board");
  expect(yaml).toContain("In Progress");
  expect(yaml).toContain("Done");
  expect(yaml).toContain("gh project item-edit");
  expect(yaml).not.toContain("PVT_");
  expect(yaml).not.toContain("project #7");
  expect(yaml).not.toContain("Roadmap 2026");
});

test("isPermissions accepts a full config and rejects malformed ones", () => {
  expect(isPermissions(DEFAULT_PERMISSIONS)).toBe(true);
  expect(isPermissions({ createPRs: true, createIssues: false, comment: true })).toBe(true);
  expect(isPermissions({ createPRs: true, createIssues: false })).toBe(false);
  expect(isPermissions(null)).toBe(false);
});

test("isModelOption accepts a full entry and rejects malformed ones", () => {
  expect(DEFAULT_MODELS.every(isModelOption)).toBe(true);
  expect(isModelOption({ model: "x", keyInput: "y", secret: "z" })).toBe(true);
  expect(isModelOption({ model: "x", keyInput: "y" })).toBe(false);
  expect(isModelOption(null)).toBe(false);
});

test("isBotConfig accepts a full config and rejects malformed ones", () => {
  expect(isBotConfig(DEFAULT_BOT)).toBe(true);
  expect(isBotConfig({ enabled: true, clientId: "a", privateKeySecret: "b" })).toBe(true);
  expect(isBotConfig({ enabled: "yes", clientId: "a", privateKeySecret: "b" })).toBe(false);
  expect(isBotConfig(null)).toBe(false);
});

test("DEFAULT_PLUGINS are the three known plugins, all disabled by default", () => {
  expect(DEFAULT_PLUGINS.map((p) => p.id)).toEqual([
    "juliusbrussee/caveman",
    "DietrichGebert/ponytail",
    "ayghri/i-have-adhd",
  ]);
  expect(DEFAULT_PLUGINS.every((p) => p.enabled === false)).toBe(true);
});

test("enabledPlugins returns only toggled-on ids", () => {
  expect(enabledPlugins(DEFAULT_PLUGINS)).toEqual([]);
  expect(
    enabledPlugins([
      { id: "a/b", enabled: true },
      { id: "c/d", enabled: false },
      { id: "e/f", enabled: true },
    ]),
  ).toEqual(["a/b", "e/f"]);
});

test("isPluginOption accepts a valid option and rejects bad shapes", () => {
  expect(isPluginOption({ id: "a/b", enabled: true })).toBe(true);
  expect(isPluginOption({ id: "a/b", enabled: "yes" })).toBe(false);
  expect(isPluginOption({ id: 1, enabled: true })).toBe(false);
  expect(isPluginOption(null)).toBe(false);
});

test("workflowYaml omits the plugins block by default (disabled by default)", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).not.toContain("plugins:");
});

test("workflowYaml omits plugins block when plugins list is empty", () => {
  const yaml = workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, []);
  expect(yaml).not.toContain("plugins:");
});

test("workflowYaml accepts custom plugins", () => {
  const custom = ["custom/plugin-a", "custom/plugin-b@v1"];
  const yaml = workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, custom);
  expect(yaml).toContain("plugins: |");
  expect(yaml).toContain("            custom/plugin-a");
  expect(yaml).toContain("            custom/plugin-b@v1");
  expect(yaml).not.toContain("inference-gateway/caveman");
});

test("workflowYaml bakes in only the enabled plugins", () => {
  const yaml = workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, enabledPlugins([
    { id: "juliusbrussee/caveman", enabled: true },
    { id: "DietrichGebert/ponytail", enabled: false },
  ]));
  expect(yaml).toContain("            juliusbrussee/caveman");
  expect(yaml).not.toContain("DietrichGebert/ponytail");
});

test("workflowYaml with plugins is backward compatible when called without plugins arg", () => {
  const withDefault = workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS);
  const withExplicit = workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, enabledPlugins(DEFAULT_PLUGINS));
  expect(withDefault).toBe(withExplicit);
});

test("prBody omits the Plugins section by default (none enabled)", () => {
  const body = prBody(models, def, noBot);
  expect(body).not.toContain("### Plugins");
});

test("prBody includes a Plugins section when plugins are given", () => {
  const body = prBody(models, def, noBot, ["DietrichGebert/ponytail"]);
  expect(body).toContain("### Plugins");
  expect(body).toContain("The workflow pre-installs the following infer-action plugins");
  expect(body).toContain("`DietrichGebert/ponytail`");
});

test("prBody accepts custom plugins", () => {
  const custom = ["custom/plugin-a"];
  const body = prBody(models, def, noBot, custom);
  expect(body).toContain("`custom/plugin-a`");
  expect(body).not.toContain("inference-gateway/caveman");
});

// deps is the trailing workflowYaml arg; this fills the ones before it.
const yamlWithDeps = (deps: DependenciesConfig) =>
  workflowYaml(models, def, noBot, DEFAULT_PERMISSIONS, [], [], DEFAULT_TIMEOUT, DEFAULT_INSTRUCTIONS, deps);

const setEnabled = (ids: string[], autoDetect = false): DependenciesConfig => ({
  autoDetect,
  items: DEFAULT_DEPENDENCIES.items.map((d) => ({ ...d, enabled: ids.includes(d.id) })),
});

test("DEFAULT_DEPENDENCIES enables only task, auto-detect off", () => {
  expect(DEFAULT_DEPENDENCIES.autoDetect).toBe(false);
  expect(DEFAULT_DEPENDENCIES.items.filter((d) => d.enabled).map((d) => d.id)).toEqual(["task"]);
});

test("workflowYaml installs task by default with repo-token and no language runtimes", () => {
  const yaml = workflowYaml(models, def, noBot);
  expect(yaml).toContain("uses: arduino/setup-task@v3.0.0");
  expect(yaml).toContain("repo-token: ${{ secrets.GITHUB_TOKEN }}");
  expect(yaml).not.toContain("setup-go");
  expect(yaml).not.toContain("hashFiles");
});

test("workflowYaml emits enabled language runtimes unconditionally, before infer-action", () => {
  const yaml = yamlWithDeps(setEnabled(["task", "go", "node"]));
  expect(yaml).toContain("uses: actions/setup-go@v7.0.0");
  expect(yaml).toContain("uses: actions/setup-node@v7.0.0");
  expect(yaml).not.toContain("uses: actions/setup-python");
  expect(yaml).not.toContain("if: hashFiles");
  expect(yaml.indexOf("setup-go")).toBeLessThan(yaml.indexOf("infer-action"));
  expect(yaml.indexOf("actions/checkout")).toBeLessThan(yaml.indexOf("setup-go"));
});

test("workflowYaml omits all dependency steps when none enabled", () => {
  const yaml = yamlWithDeps(setEnabled([]));
  expect(yaml).not.toContain("setup-task");
  expect(yaml).not.toContain("setup-go");
  expect(yaml).toContain("uses: inference-gateway/infer-action@v0.47.0");
});

test("auto-detect guards every language runtime with hashFiles and keeps task by its toggle", () => {
  const yaml = yamlWithDeps(setEnabled(["task"], true));
  expect(yaml).toContain("uses: arduino/setup-task@v3.0.0");
  expect(yaml).toContain("uses: actions/setup-go@v7.0.0\n        with:\n          go-version: stable\n        if: hashFiles('**/go.mod') != ''");
  expect(yaml).toContain("if: hashFiles('**/Cargo.toml') != ''");
  expect(yaml).toContain("if: hashFiles('**/package.json') != ''");
  expect(yaml).toContain("if: hashFiles('**/pyproject.toml', '**/requirements.txt', '**/setup.py') != ''");
});

test("auto-detect ignores the per-language toggles (rust off still emitted with guard)", () => {
  const yaml = yamlWithDeps(setEnabled([], true));
  expect(yaml).toContain("uses: dtolnay/rust-toolchain@stable\n        if: hashFiles('**/Cargo.toml') != ''");
  expect(yaml).not.toContain("uses: arduino/setup-task");
});

test("enabled language deps grant matching bash-allow-append entries; task adds none", () => {
  const yaml = yamlWithDeps(setEnabled(["task", "go"]));
  expect(yaml).toContain("gofmt( .*)?");
  expect(yaml).toContain("go (fmt|vet|test|build|run|mod|generate|tool)( .*)?");
  expect(yaml).not.toContain("cargo( .*)?");
  const none = yamlWithDeps(setEnabled(["task"]));
  expect(none).not.toContain("gofmt");
});

test("auto-detect grants allow entries for every language runtime", () => {
  const yaml = yamlWithDeps(setEnabled([], true));
  expect(yaml).toContain("gofmt( .*)?");
  expect(yaml).toContain("cargo( .*)?");
  expect(yaml).toContain("npm( .*)?");
  expect(yaml).toContain("pytest( .*)?");
});

test("Rust allow regexes match cargo miri, cargo clippy, cargo, and rustup component add miri", () => {
  const rust = DEPENDENCY_DEFS.find((d) => d.id === "rust")!;
  const cargoRe = new RegExp(`^${rust.allow!.find((a) => a.startsWith("cargo"))!}$`);
  const rustupRe = new RegExp(`^${rust.allow!.find((a) => a.startsWith("rustup"))!}$`);
  expect(cargoRe.test("cargo miri test")).toBe(true);
  expect(cargoRe.test("cargo clippy")).toBe(true);
  expect(cargoRe.test("cargo")).toBe(true);
  expect(rustupRe.test("rustup component add miri")).toBe(true);
  expect(rustupRe.test("rustup")).toBe(true);
  expect(cargoRe.test("rustup component add miri")).toBe(false);
});

test("isDependenciesConfig accepts a valid config and rejects bad shapes", () => {
  expect(isDependenciesConfig(DEFAULT_DEPENDENCIES)).toBe(true);
  expect(isDependenciesConfig({ autoDetect: true, items: [] })).toBe(true);
  expect(isDependenciesConfig({ autoDetect: "yes", items: [] })).toBe(false);
  expect(isDependenciesConfig({ autoDetect: true, items: [{ id: "go" }] })).toBe(false);
  expect(isDependenciesConfig({ autoDetect: true })).toBe(false);
  expect(isDependenciesConfig(null)).toBe(false);
});
