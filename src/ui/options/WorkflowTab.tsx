import type { BotConfig, PluginOption } from "../../shared/models";
import { DEFAULT_TIMEOUT, githubAppUrl } from "../../shared/models";
import { Section, ToggleRow } from "./Section";
import { Button } from "@/ui/components/button";
import { Input } from "@/ui/components/input";
import { Label } from "@/ui/components/label";
import { Switch } from "@/ui/components/switch";

export function WorkflowTab({
  timeout,
  setTimeoutMin,
  plugins,
  setPlugins,
  debug,
  setDebug,
  reviewInline,
  setReviewInline,
  visionModel,
  setVisionModel,
  imageModel,
  setImageModel,
  bot,
  setBot,
}: {
  timeout: number;
  setTimeoutMin: (n: number) => void;
  plugins: PluginOption[];
  setPlugins: (p: PluginOption[]) => void;
  debug: boolean;
  setDebug: (v: boolean) => void;
  reviewInline: boolean;
  setReviewInline: (v: boolean) => void;
  visionModel: string;
  setVisionModel: (v: string) => void;
  imageModel: string;
  setImageModel: (v: string) => void;
  bot: BotConfig;
  setBot: (b: BotConfig) => void;
}) {
  return (
    <>
      <Section
        title="Workflow"
        description={
          <>
            Per-run job timeout for the generated workflow. Applies to newly installed workflows; re-run{" "}
            <strong>Install</strong> on a repo to update an existing one.
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="igw-timeout">Timeout (minutes)</Label>
          <Input
            id="igw-timeout"
            type="number"
            min={1}
            className="w-32"
            value={timeout}
            onChange={(e) => setTimeoutMin(e.target.value === "" ? DEFAULT_TIMEOUT : Number(e.target.value))}
          />
        </div>
      </Section>

      <Section
        title="Debug logging"
        description={
          <>
            Enable infer-action debug-level logging and diagnostic output in the workflow run logs.
            Off by default. <strong>Re-install the workflow</strong> after changing this.
          </>
        }
      >
        <ToggleRow checked={debug} onChange={setDebug}>
          Verbose agent logs
        </ToggleRow>
      </Section>

      <Section
        title="Inline PR review comments"
        description={
          <>
            When enabled and the run is a review (<em>pull_request_review_comment</em> trigger), findings are posted as inline,
            line-anchored comments with one-click suggestion blocks (Files Changed tab). Off by default.{" "}
            <strong>Re-install the workflow</strong> after changing this.
          </>
        }
      >
        <ToggleRow checked={reviewInline} onChange={setReviewInline}>
          Post inline suggestion comments on review triggers
        </ToggleRow>
      </Section>

      <Section
        title="Images"
        description={
          <>
            Optional models for image understanding and generation.{" "}
            <strong>Re-install the workflow</strong> after changing these.
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="igw-vision-model">Vision model</Label>
          <Input
            id="igw-vision-model"
            placeholder="anthropic/claude-haiku-4-5-20251001"
            value={visionModel}
            onChange={(e) => setVisionModel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Lets the agent read screenshots and diagrams embedded in issues/PRs, even when the task
            model has no vision. Blank = off. Needs the model provider's API key secret in the repo.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="igw-image-model">Image generation model</Label>
          <Input
            id="igw-image-model"
            placeholder="openai/gpt-image-2"
            value={imageModel}
            onChange={(e) => setImageModel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Model for the agent's ImageGeneration/ImageEdit/ImageVariation tools. Blank keeps the
            CLI default (<code>openai/gpt-image-2</code>, needs <code>OPENAI_API_KEY</code>).
          </p>
        </div>
      </Section>

      <Section
        title="Custom bot"
        description={
          <>
            Run the agent as a GitHub App instead of <code>github-actions[bot]</code>. When enabled,
            the generated workflow mints a token with <code>actions/create-github-app-token@v3</code>{" "}
            and checks out + comments as your App, so its comments and commits are attributed to (and
            verified for) the App. <strong>Re-install the workflow</strong> after changing this.
          </>
        }
      >
        <div>
          <Button asChild>
            <a href={githubAppUrl("", false)} target="_blank" rel="noreferrer">
              Create GitHub App
            </a>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="igw-bot-enabled"
            checked={bot.enabled}
            onCheckedChange={(v) => setBot({ ...bot, enabled: v })}
          />
          <Label htmlFor="igw-bot-enabled">Use a custom bot (GitHub App)</Label>
        </div>
        {bot.enabled && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="igw-bot-client-id">App Client ID</Label>
            <Input
              id="igw-bot-client-id"
              placeholder="Iv23li..."
              autoComplete="off"
              value={bot.clientId}
              onChange={(e) => setBot({ ...bot, clientId: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              On your App's settings page (<strong>General</strong>) under <strong>Client ID</strong> - it
              starts with <code>Iv23li…</code>. This is <strong>not</strong> the numeric <em>App ID</em>{" "}
              (e.g. <code>4394298</code>) shown at the top of the same page. You can also enter the
              name of a repo secret holding it (e.g. <code>APP_CLIENT_ID</code>) and the workflow
              will read it from <code>secrets</code>.
            </p>
            <Label htmlFor="igw-bot-secret">Private-key secret name</Label>
            <Input
              id="igw-bot-secret"
              placeholder="OPENTASK_APP_PRIVATE_KEY"
              autoComplete="off"
              value={bot.privateKeySecret}
              onChange={(e) => setBot({ ...bot, privateKeySecret: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Add this repo secret with your App's private key. The Client ID is also wrapped in
              a secrets reference so it can be stored as a repo secret too.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Plugins"
        description={
          <>
            Optional{" "}
            <a href="https://github.com/inference-gateway/infer-action" className="underline">
              infer-action
            </a>{" "}
            plugins the installed workflow pre-installs to extend the agent. All off by default; check the
            ones you want. <strong>Re-install the workflow</strong> after changing these.
          </>
        }
      >
        {plugins.map((p) => (
          <ToggleRow
            key={p.id}
            checked={p.enabled}
            onChange={(v) => setPlugins(plugins.map((x) => (x.id === p.id ? { ...x, enabled: v } : x)))}
          >
            <code>{p.id}</code>
          </ToggleRow>
        ))}
      </Section>
    </>
  );
}
