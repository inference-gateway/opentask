// The Inference Gateway skills registry (inference-gateway/skills) and helpers for the
// Tasks panel's skills tab. The registry's root catalog.json lists every skill; each
// `source` is a GitHub tree URL pointing at the skill's folder, which "install" copies
// into the target repo's .agents/skills/<name>/ (the dir the extension already reads).
export type CatalogSkill = {
  name: string;
  description: string;
  source: string;
  tags: string[];
  categories: string[];
};

export const REGISTRY = { owner: "inference-gateway", repo: "skills" };

export function isCatalogSkill(s: unknown): s is CatalogSkill {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.source === "string";
}

// Parse a catalog `source` GitHub tree URL into its parts, e.g.
//   https://github.com/inference-gateway/skills/tree/main/skills/adl
//   https://github.com/Xquik-dev/x-twitter-scraper/tree/v2.4.16/skills/x-twitter-scraper
// ponytail: assumes the ref is a single segment (branch/tag with no slash), true for the
// registry today; refs with slashes would need the API to disambiguate ref from path.
export function parseSource(url: string): { owner: string; repo: string; ref: string; path: string } | null {
  const m = /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+?)\/?$/.exec(url);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
}

// Rank catalog skills for a repo's languages: a skill is "suggested" when any language
// (case-insensitive) appears in its name/description/tags/categories. Suggested skills come
// first; original catalog order is preserved within each group.
// ponytail: substring heuristic - upgrade to explicit language tags in the catalog if noisy.
export function suggestForLanguages(
  skills: CatalogSkill[],
  langs: string[]
): { skill: CatalogSkill; suggested: boolean }[] {
  const needles = langs.map((l) => l.toLowerCase()).filter(Boolean);
  const scored = skills.map((skill) => {
    const hay = [skill.name, skill.description, ...(skill.tags ?? []), ...(skill.categories ?? [])]
      .join(" ")
      .toLowerCase();
    return { skill, suggested: needles.some((n) => hay.includes(n)) };
  });
  return [...scored.filter((s) => s.suggested), ...scored.filter((s) => !s.suggested)];
}
