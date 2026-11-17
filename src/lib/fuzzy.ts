export type FuzzyResult<T> = { item: T; score: number; positions: number[] };

// Subsequence fuzzy filter: query chars must appear in order. Pure and
// framework-free so it is bun-testable.
export function fuzzyFilter<T>(items: T[], query: string, key: (t: T) => string): FuzzyResult<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.map((item) => ({ item, score: 0, positions: [] }));
  const out: FuzzyResult<T>[] = [];
  for (const item of items) {
    const m = match(key(item).toLowerCase(), q);
    if (m) out.push({ item, ...m });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

const MATCH_SCORE = 1;
const CONTIGUITY_BONUS = 2;
const START_ANCHOR_BONUS = 3;

function match(s: string, q: string): { score: number; positions: number[] } | null {
  const positions: number[] = [];
  let qi = 0;
  let score = 0;
  let prev = -2;
  for (let si = 0; si < s.length && qi < q.length; si++) {
    if (s[si] !== q[qi]) continue;
    positions.push(si);
    score += si === prev + 1 ? CONTIGUITY_BONUS : MATCH_SCORE;
    if (si === 0) score += START_ANCHOR_BONUS;
    prev = si;
    qi++;
  }
  return qi === q.length ? { score, positions } : null;
}
