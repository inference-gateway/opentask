import { useEffect, useState } from "react";
import { Section } from "./Section";
import { Button } from "@/ui/components/button";
import { Label } from "@/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/select";

type InstallState =
  | { kind: "idle" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

// One-click (re)install of the OpenTask workflow: sends an install prompt into
// the connected CLI's chat, so the run streams live in the side panel and the
// push / PR creation go through the usual tool-approval flow there.
// `repos` are "owner/name" full names from the CLI's gh auth; connecting is
// user-initiated from the side panel, so until then we just point at Connect.
export function InstallTab({ connected, repos, reposError, defaultRepo }: { connected: boolean; repos: string[]; reposError: string; defaultRepo?: string }) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [context, setContext] = useState("");
  const [state, setState] = useState<InstallState>({ kind: "idle" });

  useEffect(() => {
    if (!defaultRepo || owner || repo) return;
    const [o, r] = defaultRepo.split("/");
    if (o && r) {
      setOwner(o);
      setRepo(r);
    }
  }, [defaultRepo]); // eslint-disable-line react-hooks/exhaustive-deps

  const owners = [...new Set(repos.map((r) => r.split("/")[0]))];
  const repoNames = repos.filter((r) => r.startsWith(`${owner}/`)).map((r) => r.slice(owner.length + 1));

  function install() {
    void chrome.runtime.sendMessage({ type: "install", owner, repo, context }).then((resp) => {
      if (!resp) return setState({ kind: "error", message: "Failed to send install request." });
      if (resp.error) return setState({ kind: "error", message: resp.error });
      setState({ kind: "sent" });
    });
  }

  return (
    <Section
      title="Install workflow"
      description={
        <>
          Asks the connected CLI's agent to add or update{" "}
          <code>.github/workflows/tasks.yml</code> in the selected repository and open a pull
          request. The run streams in the OpenTask side panel, where you approve the push and
          PR creation. Re-installing updates the same open PR, and your repo-specific
          customizations are preserved.
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
      <Label htmlFor="igw-install-context">Additional context (optional)</Label>
      <textarea
        id="igw-install-context"
        className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
        placeholder="Anything the install agent should know about this repo's workflow…"
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />
      <div>
        <Button onClick={install} disabled={!owner || !repo}>
          Install / Re-install
        </Button>
      </div>
      {state.kind === "sent" && (
        <p className="text-sm">
          Install request sent — follow the run in the OpenTask side panel, where you'll be asked
          to approve the pull request.
        </p>
      )}
      {state.kind === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </Section>
  );
}
