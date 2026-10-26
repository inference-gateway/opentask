import { useEffect, useMemo, useState } from "react";
import type { AgentManifest } from "../../shared/agents";
import * as storage from "../../shared/storage";
import type { AgentsCatalogResponse } from "../../shared/messages";
import { Section } from "./Section";
import { Input } from "@/ui/components/input";
import { Switch } from "@/ui/components/switch";

export function AgentsTab() {
  const [catalog, setCatalog] = useState<AgentManifest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      try {
        const [resp, names] = await Promise.all([
          chrome.runtime.sendMessage({ type: "agents-catalog" }) as Promise<AgentsCatalogResponse>,
          storage.get<string[]>("selected-agents"),
        ]);
        if ("error" in resp) {
          setError(resp.error);
        } else {
          setCatalog(resp.catalog);
        }
        if (Array.isArray(names)) setSelected(new Set(names));
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      void storage.set("selected-agents", [...next]);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((a) => {
      const text = `${a.metadata.name} ${a.metadata.description} ${a.metadata.version}`.toLowerCase();
      return text.includes(q);
    });
  }, [catalog, query]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading agents…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <>
      <Section
        title="Agents"
        description={
          <>
            Select A2A agents from the{" "}
            <a href="https://github.com/inference-gateway/agents" className="underline">
              agents registry
            </a>{" "}
            to include in the installed workflow. Checked agents are added to the OpenTask workflow when you (re)install
            it.
          </>
        }
      >
        <Input placeholder="Search agents…" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No agents match.</p>}
        {filtered.map((agent) => (
          <div key={agent.metadata.name} className="flex items-start gap-3 rounded-lg border p-3">
            <Switch
              checked={selected.has(agent.metadata.name)}
              onCheckedChange={() => toggle(agent.metadata.name)}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-sm font-medium leading-none">
                {agent.metadata.name}
                <span className="ml-1.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  v{agent.metadata.version}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{agent.metadata.description}</span>
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}
