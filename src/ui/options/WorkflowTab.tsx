import type { PluginOption } from "../../shared/models";
import { DEFAULT_TIMEOUT } from "../../shared/models";
import { Section, ToggleRow } from "./Section";
import { Input } from "@/ui/components/input";
import { Label } from "@/ui/components/label";

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
