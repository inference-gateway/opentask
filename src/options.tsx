import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as storage from "./shared/storage";
import { DEFAULT_PROMPTS, mergePrompts, type Prompt } from "./shared/prompts";
import { DEFAULT_MODELS, DEFAULT_BOT, DEFAULT_PERMISSIONS, DEFAULT_REFINE, DEFAULT_PLUGINS, DEFAULT_INIT, DEFAULT_TIMEOUT, DEFAULT_INSTRUCTIONS, DEFAULT_DEPENDENCIES, normalizeTimeout, isBotConfig, isPermissions, isRefineConfig, isPluginOption, isInitConfig, isDependenciesConfig, type BotConfig, type Permissions, type RefineConfig, type PluginOption, type InitConfig, type DependenciesConfig } from "./shared/models";
import { DEFAULT_REFINE_PROMPT } from "./shared/task";
import { applyTheme, type Theme } from "./shared/theme";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/tabs";
import { Button } from "@/ui/components/button";
import { InstallTab } from "./ui/options/InstallTab";
import { OrchestratorTab } from "./ui/options/OrchestratorTab";
import { AgentsTab } from "./ui/options/AgentsTab";
import { PromptsTab } from "./ui/options/PromptsTab";
import { WorkflowTab } from "./ui/options/WorkflowTab";
import { DependenciesTab } from "./ui/options/DependenciesTab";
import { AppearanceTab } from "./ui/options/AppearanceTab";

function Options() {
  const [bot, setBot] = useState<BotConfig>(DEFAULT_BOT);
  const [promptsText, setPromptsText] = useState("");
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
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void (async () => {
      const b = await storage.get<unknown>("bot");
      setBot(isBotConfig(b) ? b : DEFAULT_BOT);
      const p = mergePrompts(await storage.get<Prompt[]>("prompts"));
      setPromptsText(JSON.stringify(p, null, 2));
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
        apt: dpc.apt ?? "",
        items: DEFAULT_DEPENDENCIES.items.map((d) => ({ ...d, enabled: dpc.items.find((s) => s.id === d.id)?.enabled ?? d.enabled })),
      });
      const t = (await storage.get<string>("theme")) as Theme | undefined;
      const resolved = t === "light" || t === "dark" ? t : "system";
      setTheme(resolved);
      applyTheme(resolved);
    })();
  }, []);

  // Owner dropdown for the Install tab comes from the CLI's gh auth (via the bridge).
  useEffect(() => {
    let cancelled = false;
    void chrome.runtime.sendMessage({ type: "list-owners" }).then((r) => {
      if (cancelled || !r || !Array.isArray(r.owners)) return;
      setOwnerOptions(r.owners);
    });
    return () => { cancelled = true; };
  }, []);

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
    if (bot.enabled && (!bot.clientId.trim() || !bot.privateKeySecret.trim())) {
      return setStatus("Custom Bot needs a Client ID and a private-key secret name.");
    }
    await storage.set("bot", { enabled: bot.enabled, clientId: bot.clientId.trim(), privateKeySecret: bot.privateKeySecret.trim() });
    await storage.set("prompts", parsed);
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

  function reset() {
    setPromptsText(JSON.stringify(DEFAULT_PROMPTS, null, 2));
    setInstructions(DEFAULT_INSTRUCTIONS);
    setRefinePromptText(DEFAULT_REFINE_PROMPT);
    setBot(DEFAULT_BOT);
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

  const modelNames = DEFAULT_MODELS.map((x) => x.model);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-4">OpenTask settings</h1>

      <Tabs defaultValue="install">
        <TabsList>
          <TabsTrigger value="install">Install</TabsTrigger>
          <TabsTrigger value="orchestrator">Orchestrator</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="install" className="flex flex-col gap-4">
          <InstallTab owners={ownerOptions} models={modelNames} />
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
          <WorkflowTab timeout={timeout} setTimeoutMin={setTimeoutMin} plugins={plugins} setPlugins={setPlugins} debug={debug} setDebug={setDebug} reviewInline={reviewInline} setReviewInline={setReviewInline} visionModel={visionModel} setVisionModel={setVisionModel} imageModel={imageModel} setImageModel={setImageModel} bot={bot} setBot={setBot} />
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
