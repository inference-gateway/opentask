// Presentational skill dropdown, anchored at the caret. No focus, no local state -
// the controller owns activeIndex and keyboard nav so the textarea keeps focus.
import type { ReactNode } from "react";
import type { SkillView } from "./types";

export function Menu({ results, activeIndex, pos, onHover, onSelect }: SkillView) {
  const left = Math.min(pos.left, window.innerWidth - 260);
  const style = { left: Math.max(8, left), top: pos.top + pos.height + 2 };
  return (
    <div className="igw-menu" style={style} role="listbox">
      {results.length === 0 && <div className="igw-empty">No matching skill</div>}
      {results.map((r, i) => (
        <div
          key={r.item.name}
          className={"igw-item" + (i === activeIndex ? " igw-active" : "")}
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault(); // keep the textarea focused
            onSelect(i);
          }}
        >
          <span className="igw-name">{highlight(r.item.name, r.positions)}</span>
        </div>
      ))}
    </div>
  );
}

export function highlight(text: string, positions: number[]): ReactNode {
  if (positions.length === 0) return text;
  const hit = new Set(positions);
  return [...text].map((ch, i) => (hit.has(i) ? <b key={i}>{ch}</b> : <span key={i}>{ch}</span>));
}
