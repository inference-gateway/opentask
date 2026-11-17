import { useEffect, useRef, useState } from "react";
import { fuzzyFilter } from "../lib/fuzzy";
import type { PaletteView } from "./types";

const PALETTE_MAX_WIDTH = 420;
const PALETTE_WIDTH_RATIO = 0.92;
const MENU_MARGIN = 8;

// Quick-prompt palette: a self-contained popup with its own search input, focus,
// and keyboard handling, opened by the shortcut or the injected toolbar button.
export function Palette({ prompts, pos, onPick, onClose }: PaletteView) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = fuzzyFilter(prompts, query, (p) => `${p.label} ${p.insert}`);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) onPick(r.item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const width = Math.min(PALETTE_MAX_WIDTH, window.innerWidth * PALETTE_WIDTH_RATIO);
  const left = Math.min(Math.max(MENU_MARGIN, pos.left), window.innerWidth - width - MENU_MARGIN);
  const top = pos.top + pos.height + 4;

  return (
    <div className="igw-palette-backdrop" onMouseDown={onClose}>
      <div className="igw-palette" style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="igw-palette-input"
          placeholder="Quick prompts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="igw-palette-list" role="listbox">
          {results.length === 0 && <div className="igw-empty">No matching prompt</div>}
          {results.map((r, i) => (
            <div
              key={r.item.id}
              className={"igw-item" + (i === active ? " igw-active" : "")}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(r.item);
              }}
            >
              <span className="igw-name">{r.item.label}</span>
              <span className="igw-desc">{r.item.description}</span>
              <code className="igw-insert">{r.item.insert}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
