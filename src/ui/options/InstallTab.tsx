import { useState } from "react";
import { Section } from "./Section";
import { Button } from "@/ui/components/button";
import { Input } from "@/ui/components/input";
import { Label } from "@/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/select";

type InstallState =
  | { kind: "idle" }
  | { kind: "installing" }
  | { kind: "done"; prUrl: string; manual?: boolean }
  | { kind: "error"; message: string };

// One-click (re)install of the OpenTask workflow. Re-install is an idempotent
// reconcile of the marker-delimited managed section, so clicking twice is safe.
export function InstallTab({ owners, models }: { owners: string[]; models: string[] }) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [model, setModel] = useState(models[0] ?? "");
  const [state, setState] = useState<InstallState>({ kind: "idle" });

  function install() {
    setState({ kind: "installing" });
    void chrome.runtime.sendMessage({ type: "install", owner: owner.trim(), repo: repo.trim(), model }).then((resp) => {
      if (!resp) return setState({ kind: "error", message: "Failed to send install request." });
      if (resp.error) return setState({ kind: "error", message: resp.error });
      setState({ kind: "done", prUrl: resp.prUrl as string, manual: resp.manual as boolean | undefined });
    });
  }

  return (
    <Section
      title="Install workflow"
      description={
        <>
          Opens a pull request adding <code>.github/workflows/tasks.yml</code> to the repo.
          Re-installing updates only the section between the <code># opentask:begin</code> and{" "}
          <code># opentask:end</code> markers - your own edits outside it are preserved.
        </>
      }
    >
      <Label htmlFor="igw-install-owner">Owner</Label>
      <Select value={owner || undefined} onValueChange={setOwner}>
        <SelectTrigger id="igw-install-owner">
          <SelectValue placeholder={owners.length ? "Select an owner…" : "Connect the infer CLI to load owners"} />
        </SelectTrigger>
        <SelectContent>
          {owners.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="igw-install-repo">Repository</Label>
      <Input
        id="igw-install-repo"
        placeholder="my-repo"
        autoComplete="off"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
      />
      <Label htmlFor="igw-install-model">Default model</Label>
      <Select value={model || undefined} onValueChange={setModel}>
        <SelectTrigger id="igw-install-model">
          <SelectValue placeholder="Select a model…" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div>
        <Button onClick={install} disabled={state.kind === "installing" || !owner.trim() || !repo.trim()}>
          {state.kind === "installing" ? "Creating pull request…" : "Install / Re-install"}
        </Button>
      </div>
      {state.kind === "done" && (
        <p className="text-sm">
          {state.manual ? "Branch pushed - GitHub's PR API is erroring right now, open the PR manually: " : "Pull request created: "}
          <a className="underline" href={state.prUrl} target="_blank" rel="noreferrer">
            {state.manual ? "Open pull request" : "View PR"}
          </a>
        </p>
      )}
      {state.kind === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </Section>
  );
}
