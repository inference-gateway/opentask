import { useState } from "react";
import { Section } from "./Section";
import { Button } from "@/ui/components/button";
import { Label } from "@/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/select";

type InstallState =
  | { kind: "idle" }
  | { kind: "installing" }
  | { kind: "done"; prUrl: string }
  | { kind: "error"; message: string };

// One-click (re)install of the OpenTask workflow, delegated to the CLI:
// `infer workflow install` runs an agent that merges changes into the existing
// workflow (preserving repo customizations) and opens - or updates - the PR.
// `repos` are "owner/name" full names from the CLI's gh auth; connecting is
// user-initiated from the side panel, so until then we just point at Connect.
export function InstallTab({ connected, repos, reposError, models }: { connected: boolean; repos: string[]; reposError: string; models: string[] }) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [model, setModel] = useState(models[0] ?? "");
  const [context, setContext] = useState("");
  const [state, setState] = useState<InstallState>({ kind: "idle" });

  const owners = [...new Set(repos.map((r) => r.split("/")[0]))];
  const repoNames = repos.filter((r) => r.startsWith(`${owner}/`)).map((r) => r.slice(owner.length + 1));

  function install() {
    setState({ kind: "installing" });
    void chrome.runtime.sendMessage({ type: "install", owner, repo, model, context }).then((resp) => {
      if (!resp) return setState({ kind: "error", message: "Failed to send install request." });
      if (resp.error) return setState({ kind: "error", message: resp.error });
      setState({ kind: "done", prUrl: resp.prUrl as string });
    });
  }

  return (
    <Section
      title="Install workflow"
      description={
        <>
          Runs <code>infer workflow install</code> through the connected CLI: an agent reads the
          repo's existing workflow, languages, and CI conventions, then opens a pull request
          adding or updating <code>.github/workflows/tasks.yml</code>. Re-installing updates the
          same open PR, and your repo-specific customizations are preserved.
        </>
      }
    >
      {!connected && (
        <p className="text-sm text-muted-foreground">
          Not connected to the infer CLI. Open the OpenTask side panel and click{" "}
          <strong>Connect</strong> to load your repositories.
        </p>
      )}
      {connected && reposError && !repos.length && <p className="text-sm text-destructive">{reposError}</p>}
      <Label htmlFor="igw-install-owner">Owner</Label>
      <Select value={owner || undefined} onValueChange={(o) => { setOwner(o); setRepo(""); }} disabled={!owners.length}>
        <SelectTrigger id="igw-install-owner">
          <SelectValue placeholder={connected ? "Select an owner…" : "Connect the infer CLI first"} />
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
      <Select value={repo || undefined} onValueChange={setRepo} disabled={!repoNames.length}>
        <SelectTrigger id="igw-install-repo">
          <SelectValue placeholder={owner ? "Select a repository…" : "Select an owner first"} />
        </SelectTrigger>
        <SelectContent>
          {repoNames.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="igw-install-model">Default model</Label>
      <Select value={model || undefined} onValueChange={setModel} disabled={!models.length}>
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
      <Label htmlFor="igw-install-context">Additional context (optional)</Label>
      <textarea
        id="igw-install-context"
        className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
        placeholder="Anything the install agent should know about this repo's workflow…"
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />
      <div>
        <Button onClick={install} disabled={state.kind === "installing" || !owner || !repo}>
          {state.kind === "installing" ? "Agent is working (takes a few minutes)…" : "Install / Re-install"}
        </Button>
      </div>
      {state.kind === "done" && (
        <p className="text-sm">
          Pull request ready:{" "}
          <a className="underline" href={state.prUrl} target="_blank" rel="noreferrer">
            View PR
          </a>
        </p>
      )}
      {state.kind === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </Section>
  );
}
