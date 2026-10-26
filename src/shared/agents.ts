export type AgentManifest = {
  metadata: {
    name: string;
    description: string;
    version: string;
  };
  _source?: {
    repo: string;
    ref: string;
  };
};

export const CATALOG_URL = "https://cdn.jsdelivr.net/gh/inference-gateway/agents@main/catalog.json";

export function isAgentManifest(m: unknown): m is AgentManifest {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  const meta = o.metadata as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== "object") return false;
  return typeof meta.name === "string" && typeof meta.description === "string" && typeof meta.version === "string";
}

// The catalog is a wrapper object { version, updated, agents: [...] }; a bare
// array shape is tolerated for forward-compat.
export function agentsFromCatalog(json: unknown): AgentManifest[] {
  const arr = Array.isArray(json)
    ? json
    : Array.isArray((json as { agents?: unknown })?.agents)
      ? (json as { agents: unknown[] }).agents
      : [];
  return arr.filter(isAgentManifest);
}
