import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as storage from "./shared/storage";
import type { PatEntry, BotEntry } from "./shared/storage";
import { DEFAULT_PROMPTS, mergePrompts, type Prompt } from "./shared/prompts";
import { DEFAULT_MODELS, DEFAULT_BOT, DEFAULT_PERMISSIONS, DEFAULT_REFINE, DEFAULT_PLUGINS, DEFAULT_INIT, DEFAULT_TIMEOUT, DEFAULT_INSTRUCTIONS, DEFAULT_DEPENDENCIES, normalizeTimeout, isModelOption, isPermissions, isRefineConfig, isPluginOption, isInitConfig, isDependenciesConfig, githubAppUrl, type BotConfig, type Permissions, type RefineConfig, type PluginOption, type InitConfig, type DependenciesConfig } from "./shared/models";
import { DEFAULT_REFINE_PROMPT } from "./shared/task";
import { applyTheme, type Theme } from "./shared/theme";
import type { Account } from "./ui/options/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/tabs";
import { Button } from "@/ui/components/button";
import { AccountsTab } from "./ui/options/AccountsTab";
import { OrchestratorTab } from "./ui/options/OrchestratorTab";
import { AgentsTab } from "./ui/options/AgentsTab";
import { ModelsTab } from "./ui/options/ModelsTab";
import { PromptsTab } from "./ui/options/PromptsTab";
import { WorkflowTab } from "./ui/options/WorkflowTab";
import { DependenciesTab } from "./ui/options/DependenciesTab";
import { AppearanceTab } from "./ui/options/AppearanceTab";

// Merges the two owner-keyed lists into accounts. Empty -> one blank starter row.
function mergeAccounts(toks: PatEntry[], bots: BotEntry[]): Account[] {
  const owners = [...new Set([...toks.map((t) => t.owner), ...bots.map((b) => b.owner)])].filter(Boolean);
  const accounts = owners.map((owner) => {
    const be = bots.find((b) => b.owner === owner);
    return {
      owner,
      token: toks.find((t) => t.owner === owner)?.token ?? "",
      bot: be ? { enabled: be.enabled, clientId: be.clientId, privateKeySecret: be.privateKeySecret } : DEFAULT_BOT,
    };
  });
  return accounts.length ? accounts : [{ owner: "", token: "", bot: DEFAULT_BOT }];
}

function Options() {
  const [accounts, setAccounts] = useState<Account[]>([{ owner: "", token: "", bot: DEFAULT_BOT }]);
  const [selected, setSelected] = useState(0);
  const [promptsText, setPromptsText] = useState("");
  const [modelsText, setModelsText] = useState("");
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [refinePromptText, setRefinePromptText] = useState(DEFAULT_REFINE_PROMPT);
  const [perms, setPerms] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [refine, setRefine] = useState<RefineConfig>(DEFAULT_REFINE);
  const [init, setInit] = useState<InitConfig>(DEFAULT_INIT);
  const [timeout, setTimeoutMin] = useState<number>(DEFAULT_TIMEOUT);
  const [plugins, setPlugins] = useState<PluginOption[]>(DEFAULT_PLUGINS);
  const [debug, setDebug] = useState(false);
  const [reviewInline, setReviewInline] = useState(false);
  const [visionModel, setVisionModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [deps, setDeps] = useState<DependenciesConfig>(DEFAULT_DEPENDENCIES);
  const [theme, setTheme] = useState<Theme>("system");
  const [showToken, setShowToken] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [orgOwners, setOrgOwners] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void (async () => {
      const toks = await storage.loadTokens();
      const bots = await storage.loadBots();
      setAccounts(mergeAccounts(toks, bots));
      const p = mergePrompts(await storage.get<Prompt[]>("prompts"));
      setPromptsText(JSON.stringify(p, null, 2));
      const m = (await storage.get<unknown[]>("models")) ?? DEFAULT_MODELS;
      setModelsText(JSON.stringify(m, null, 2));
      setInstructions((await storage.get<string>("instructions")) ?? DEFAULT_INSTRUCTIONS);
      setRefinePromptText((await storage.get<string>("refinePrompt")) ?? DEFAULT_REFINE_PROMPT);
      const pm = await storage.get<unknown>("permissions");
      setPerms(isPermissions(pm) ? pm : DEFAULT_PERMISSIONS);
      const rf = await storage.get<unknown>("refine");
      setRefine(isRefineConfig(rf) ? rf : DEFAULT_REFINE);
      const it = await storage.get<unknown>("init");
      setInit(isInitConfig(it) ? it : DEFAULT_INIT);
      setTimeoutMin(normalizeTimeout(await storage.get<unknown>("timeout")));
      setDebug((await storage.get<boolean>("debug")) ?? false);
      setReviewInline((await storage.get<boolean>("reviewInline")) ?? false);
      setVisionModel((await storage.get<string>("visionModel")) ?? "");
      setImageModel((await storage.get<string>("imageModel")) ?? "");
      const pl = await storage.get<unknown>("plugins");
      const stored = Array.isArray(pl) ? pl.filter(isPluginOption) : [];
      setPlugins(DEFAULT_PLUGINS.map((p) => ({ ...p, enabled: stored.find((s) => s.id === p.id)?.enabled ?? p.enabled })));
      const dp = await storage.get<unknown>("dependencies");
      const dpc = isDependenciesConfig(dp) ? dp : DEFAULT_DEPENDENCIES;
      setDeps({
        autoDetect: dpc.autoDetect,
        customSteps: dpc.customSteps ?? "",
        apt: dpc.apt ?? "",
        items: DEFAULT_DEPENDENCIES.items.map((d) => ({ ...d, enabled: dpc.items.find((s) => s.id === d.id)?.enabled ?? d.enabled })),
      });
      const t = (await storage.get<string>("theme")) as Theme | undefined;
      const resolved = t === "light" || t === "dark" ? t : "system";
      setTheme(resolved);
      applyTheme(resolved);
    })();
  }, []);

  const activeToken = (accounts[selected] ?? accounts[0]).token.trim();
  useEffect(() => {
    if (!activeToken) { setOwnerOptions([]); setOrgOwners([]); return; }
    let cancelled = false;
    void chrome.runtime.sendMessage({ type: "list-owners", token: activeToken }).then((r) => {
      if (cancelled || !r || !Array.isArray(r.owners)) return;
      setOwnerOptions(r.owners);
      setOrgOwners(Array.isArray(r.orgs) ? r.orgs : []);
    });
    return () => { cancelled = true; };
  }, [activeToken]);

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(promptsText);
    } catch {
      return setStatus("Prompts must be valid JSON.");
    }
    if (!Array.isArray(parsed) || !parsed.every(isPrompt)) {
      return setStatus("Prompts must be an array of { id, label, description, insert }.");
    }
    let models: unknown;
    try {
      models = JSON.parse(modelsText);
    } catch {
      return setStatus("Models must be valid JSON.");
    }
    if (!Array.isArray(models) || !models.length || !models.every(isModelOption)) {
      return setStatus("Models must be a non-empty array of { model, keyInput, secret }.");
    }
    if (accounts.some((a) => a.bot.enabled && (!a.bot.clientId.trim() || !a.bot.privateKeySecret.trim()))) {
      return setStatus("Custom Bot needs a Client ID and a private-key secret name.");
    }
    await storage.saveTokens(accounts.map((a) => ({ owner: a.owner, token: a.token })));
    await storage.saveBots(accounts.map((a) => ({ owner: a.owner, ...a.bot })));
    await storage.set("prompts", parsed);
    await storage.set("models", models);
    await storage.set("instructions", instructions);
    await storage.set("refinePrompt", refinePromptText);
    await storage.set("permissions", perms);
    await storage.set("refine", refine);
    await storage.set("init", init);
    await storage.set("timeout", normalizeTimeout(timeout));
    await storage.set("debug", debug);
    await storage.set("reviewInline", reviewInline);
    await storage.set("visionModel", visionModel.trim());
    await storage.set("imageModel", imageModel.trim());
    await storage.set("plugins", plugins);
    await storage.set("dependencies", deps);
    await storage.set("theme", theme);
    setStatus("Saved.");
  }

  function updateAccount(patch: Partial<Account>) {
    setAccounts((prev) => prev.map((a, j) => (j === selected ? { ...a, ...patch } : a)));
  }

  function updateBot(patch: Partial<BotConfig>) {
    updateAccount({ bot: { ...account.bot, ...patch } });
  }

  function addAccount() {
    setAccounts((prev) => [...prev, { owner: "", token: "", bot: DEFAULT_BOT }]);
    setSelected(accounts.length);
  }

  function removeAccount() {
    setAccounts((prev) => {
      const next = prev.filter((_, j) => j !== selected);
      return next.length ? next : [{ owner: "", token: "", bot: DEFAULT_BOT }];
    });
    setSelected(0);
  }

  function reset() {
    setPromptsText(JSON.stringify(DEFAULT_PROMPTS, null, 2));
    setModelsText(JSON.stringify(DEFAULT_MODELS, null, 2));
    setInstructions(DEFAULT_INSTRUCTIONS);
    setRefinePromptText(DEFAULT_REFINE_PROMPT);
    updateAccount({ bot: DEFAULT_BOT });
    setPerms(DEFAULT_PERMISSIONS);
    setRefine(DEFAULT_REFINE);
    setInit(DEFAULT_INIT);
    setTimeoutMin(DEFAULT_TIMEOUT);
    setDebug(false);
    setReviewInline(false);
    setPlugins(DEFAULT_PLUGINS);
    setDeps(DEFAULT_DEPENDENCIES);
    setStatus("Reset to defaults (not yet saved).");
  }

  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  const account = accounts[selected] ?? accounts[0];
  const appUrl = githubAppUrl(account.owner, orgOwners.includes(account.owner));
  const ownerChoices = [...new Set([...accounts.map((a) => a.owner), ...ownerOptions])].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-4">OpenTask settings</h1>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="orchestrator">Orchestrator</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="flex flex-col gap-4">
          <AccountsTab
            account={account}
            accounts={accounts}
            selected={selected}
            activeToken={activeToken}
            ownerChoices={ownerChoices}
            appUrl={appUrl}
            showToken={showToken}
            setShowToken={setShowToken}
            setSelected={setSelected}
            updateAccount={updateAccount}
            updateBot={updateBot}
            addAccount={addAccount}
            removeAccount={removeAccount}
          />
        </TabsContent>

        <TabsContent value="models" className="flex flex-col gap-4">
          <ModelsTab modelsText={modelsText} setModelsText={setModelsText} />
        </TabsContent>

        <TabsContent value="orchestrator" className="flex flex-col gap-4">
          <OrchestratorTab perms={perms} setPerms={setPerms} refine={refine} setRefine={setRefine} init={init} setInit={setInit} />
        </TabsContent>

        <TabsContent value="agents" className="flex flex-col gap-4">
          <AgentsTab />
        </TabsContent>

        <TabsContent value="prompts" className="flex flex-col gap-4">
          <PromptsTab promptsText={promptsText} setPromptsText={setPromptsText} instructions={instructions} setInstructions={setInstructions} refinePromptText={refinePromptText} setRefinePromptText={setRefinePromptText} />
        </TabsContent>

        <TabsContent value="workflow" className="flex flex-col gap-4">
          <WorkflowTab timeout={timeout} setTimeoutMin={setTimeoutMin} plugins={plugins} setPlugins={setPlugins} debug={debug} setDebug={setDebug} reviewInline={reviewInline} setReviewInline={setReviewInline} visionModel={visionModel} setVisionModel={setVisionModel} imageModel={imageModel} setImageModel={setImageModel} />
        </TabsContent>

        <TabsContent value="dependencies" className="flex flex-col gap-4">
          <DependenciesTab deps={deps} setDeps={setDeps} />
        </TabsContent>

        <TabsContent value="appearance" className="flex flex-col gap-4">
          <AppearanceTab theme={theme} setTheme={changeTheme} />
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3 mt-6 border-t pt-4">
        <Button onClick={save}>Save</Button>
        <Button variant="outline" onClick={reset}>
          Reset to defaults
        </Button>
        <span className="text-sm text-muted-foreground">{status}</span>
      </div>
    </div>
  );
}

function isPrompt(p: unknown): p is Prompt {
  return (
    !!p &&
    typeof p === "object" &&
    ["id", "label", "description", "insert"].every((k) => typeof (p as Record<string, unknown>)[k] === "string")
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
