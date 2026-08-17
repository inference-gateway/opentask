// Sidepanel "/" skill dropdown, anchored above the caret. Reuses the fuzzy
// highlight from Menu but is Tailwind-styled for the panel (Menu's igw-* classes
// depend on GitHub CSS vars absent here). Badge color encodes the skill source.
import { highlight } from "./Menu";
import type { CaretPos } from "../lib/caret";
import type { PanelSkill } from "../shared/agui";

export type SkillItem = { item: PanelSkill; positions: number[] };

const SCOPE_BADGE: Record<string, { label: string; className: string }> = {
  project: { label: "project", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  agents: { label: "project", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  user: { label: "global", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  plugin: { label: "plugin", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  catalog: { label: "registry", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

const FALLBACK_BADGE = { label: "skill", className: "bg-muted text-muted-foreground" };

export function SkillMenu({
  results,
  activeIndex,
  pos,
  onHover,
  onSelect,
}: {
  results: SkillItem[];
  activeIndex: number;
  pos: CaretPos;
  onHover: (i: number) => void;
  onSelect: (i: number) => void;
}) {
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - 268));
  const style = { left, bottom: window.innerHeight - pos.top + 6 };
  return (
    <div
      className="fixed z-50 max-h-64 w-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-lg"
      style={style}
      role="listbox"
    >
      {results.length === 0 && (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">No matching skill</div>
      )}
      {results.map((r, i) => {
        const badge = SCOPE_BADGE[r.item.scope] ?? FALLBACK_BADGE;
        return (
          <div
            key={r.item.scope + ":" + r.item.name}
            className={
              "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 " +
              (i === activeIndex ? "bg-indigo-500/10" : "hover:bg-muted/60")
            }
            role="option"
            aria-selected={i === activeIndex}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(i);
            }}
          >
            <span className="min-w-0 flex-1 truncate text-xs">{highlight(r.item.name, r.positions)}</span>
            <span className={"shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium " + badge.className}>
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
