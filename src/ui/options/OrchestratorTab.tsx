import type { Permissions, RefineConfig, InitConfig } from "../../shared/models";
import { Section, ToggleRow } from "./Section";
import { Input } from "@/ui/components/input";
import { Button } from "@/ui/components/button";
import { Label } from "@/ui/components/label";
import { useEffect, useState } from "react";
import * as storage from "../../shared/storage";

export function OrchestratorTab({
  perms,
  setPerms,
  refine,
  setRefine,
  init,
  setInit,
}: {
  perms: Permissions;
  setPerms: (p: Permissions) => void;
  refine: RefineConfig;
  setRefine: (r: RefineConfig) => void;
  init: InitConfig;
  setInit: (i: InitConfig) => void;
}) {
  const [runpodKey, setRunpodKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [bridgePort, setBridgePort] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [showBridgeToken, setShowBridgeToken] = useState(false);

  useEffect(() => {
    void storage.get<string>("runpod-key").then((k) => setRunpodKey(k ?? ""));
    void storage.get<string>("bridge-port").then((p) => setBridgePort(p ?? ""));
    void storage.get<string>("bridge-token").then((t) => setBridgeToken(t ?? ""));
  }, []);

  return (
    <>
      <Section
        title="Permissions"
        description={
          <>
            What the OpenTask agent may do while a task runs. These widen infer-action's read-only
            baseline; unchecked capabilities stay blocked. <strong>Re-install the workflow</strong> after
            changing these.
          </>
        }
      >
        <ToggleRow checked={perms.createPRs} onChange={(v) => setPerms({ ...perms, createPRs: v })}>
          Create pull requests (commit &amp; push)
        </ToggleRow>
        <ToggleRow checked={perms.createIssues} onChange={(v) => setPerms({ ...perms, createIssues: v })}>
          Create GitHub issues
        </ToggleRow>
        <ToggleRow checked={perms.comment} onChange={(v) => setPerms({ ...perms, comment: v })}>
          Comment on issues &amp; pull requests
        </ToggleRow>
      </Section>

      <Section
        title="Issue refinement"
        description={
          <>
            Let the OpenTask agent rewrite an issue's description in place. Refine edits the issue body
            via <code>gh issue edit</code>, so the installed workflow needs <code>Create GitHub issues</code>{" "}
            permission above - <strong>re-install</strong> after enabling.
          </>
        }
      >
        <ToggleRow checked={refine.manual} onChange={(v) => setRefine({ ...refine, manual: v })}>
          Show a Refine button on issue pages
        </ToggleRow>
        <ToggleRow checked={refine.auto} onChange={(v) => setRefine({ ...refine, auto: v })}>
          Auto-refine issues you create on GitHub
        </ToggleRow>
      </Section>

      <Section
        title="Project init"
        description={
          <>
            What the <strong>Init</strong> button (in a repo's nav) asks the agent to scaffold. It always
            generates an <code>AGENTS.md</code> and opens a PR; these add optional extras. Requires the
            OpenTask Agent workflow to be installed on the repo.
          </>
        }
      >
        <ToggleRow checked={init.githooks} onChange={(v) => setInit({ ...init, githooks: v })}>
          Add a <code>.githooks/pre-commit</code> hook
        </ToggleRow>
        <ToggleRow checked={init.claudeSymlink} onChange={(v) => setInit({ ...init, claudeSymlink: v })}>
          Symlink <code>CLAUDE.md</code> &rarr; <code>AGENTS.md</code>
        </ToggleRow>
        <ToggleRow checked={init.skillsSymlink} onChange={(v) => setInit({ ...init, skillsSymlink: v })}>
          Symlink <code>.claude/skills</code> &rarr; <code>.agents/skills</code>
        </ToggleRow>
      </Section>

      <Section
        title="RunPod GPU"
        description={
          <>
            Provision on-demand GPU instances from the extension popup. Get your API key from{" "}
            <a className="text-primary hover:underline" href="https://www.runpod.io/console/user/settings" target="_blank" rel="noreferrer">RunPod settings</a>.
          </>
        }
      >
        <Label htmlFor="runpod-key">RunPod API key</Label>
        <div className="flex items-center gap-2">
          <Input
            id="runpod-key"
            type={showKey ? "text" : "password"}
            className="flex-1"
            placeholder="rpk_..."
            autoComplete="off"
            value={runpodKey}
            onChange={(e) => {
              setRunpodKey(e.target.value);
              void storage.set("runpod-key", e.target.value);
            }}
          />
          <Button variant="outline" onClick={() => setShowKey((v) => !v)}>
            {showKey ? "Hide" : "Show"}
          </Button>
        </div>
      </Section>

      <Section
        title="CLI Bridge"
        description={
          <>
            Let the infer CLI drive this browser and mirror its conversation into the side panel.
            The token comes from <code>extension.token</code> in <code>~/.infer/browser_use.yaml</code>{" "}
            (<code>infer init</code> seeds one).
          </>
        }
      >
        <Label htmlFor="bridge-port">CLI port</Label>
        <Input
          id="bridge-port"
          className="w-32"
          placeholder="52789"
          inputMode="numeric"
          value={bridgePort}
          onChange={(e) => {
            setBridgePort(e.target.value);
            void storage.set("bridge-port", e.target.value);
          }}
        />
        <Label htmlFor="bridge-token">Shared token</Label>
        <div className="flex items-center gap-2">
          <Input
            id="bridge-token"
            type={showBridgeToken ? "text" : "password"}
            className="flex-1"
            autoComplete="off"
            value={bridgeToken}
            onChange={(e) => {
              setBridgeToken(e.target.value);
              void storage.set("bridge-token", e.target.value);
            }}
          />
          <Button variant="outline" onClick={() => setShowBridgeToken((v) => !v)}>
            {showBridgeToken ? "Hide" : "Show"}
          </Button>
        </div>
      </Section>
    </>
  );
}
