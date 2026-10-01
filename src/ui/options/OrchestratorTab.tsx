import type { Permissions, RefineConfig, InitConfig } from "../../shared/models";
import { RECORD_CAP_DEFAULT, RECORD_CAP_MAX, RECORD_CAP_MIN, normalizeRecordCap } from "../../shared/recording";
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
  const [bridgeProjectDir, setBridgeProjectDir] = useState("");
  const [showBridgeToken, setShowBridgeToken] = useState(false);
  const [recordCap, setRecordCap] = useState(String(RECORD_CAP_DEFAULT));

  useEffect(() => {
    void storage.get<string>("runpod-key").then((k) => setRunpodKey(k ?? ""));
    void storage.get<string>("bridge-port").then((p) => setBridgePort(p ?? ""));
    void storage.get<string>("bridge-token").then((t) => setBridgeToken(t ?? ""));
    void storage.get<unknown>("record-cap-seconds").then((v) => setRecordCap(String(normalizeRecordCap(v))));
    void storage.get<string>("bridge-project-dir").then((d) => setBridgeProjectDir(d ?? ""));
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
          Auto-refine issues you create
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
            Connect the side panel to <code>infer daemon</code>, which also drives this browser. The port and
            token come from <code>binding</code> in <code>~/.infer/daemon.yaml</code> or{" "}
            <code>extension</code> in <code>~/.infer/browser_use.yaml</code> (<code>infer init</code> seeds a token).
            Conversations open in the project directory.
          </>
        }
      >
        <Label htmlFor="bridge-port">Daemon port</Label>
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
        <Label htmlFor="bridge-project-dir">Project directory</Label>
        <Input
          id="bridge-project-dir"
          placeholder="/absolute/path/to/project"
          autoComplete="off"
          value={bridgeProjectDir}
          onChange={(e) => {
            setBridgeProjectDir(e.target.value);
            void storage.set("bridge-project-dir", e.target.value);
          }}
        />
      </Section>

      <Section
        title="Tab recording"
        description={
          <>
            Record the current tab (Chrome and Edge only) and attach the saved file to a task so
            the agent can distill the demonstrated flow into a skill. The recording hard-stops at
            this cap and is sized to stay under GitHub's 10 MB attachment limit.
          </>
        }
      >
        <Label htmlFor="record-cap">Recording cap (seconds)</Label>
        <Input
          id="record-cap"
          className="w-32"
          type="number"
          min={RECORD_CAP_MIN}
          max={RECORD_CAP_MAX}
          value={recordCap}
          onChange={(e) => {
            setRecordCap(e.target.value);
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n > 0) void storage.set("record-cap-seconds", normalizeRecordCap(n));
          }}
        />
      </Section>
    </>
  );
}
