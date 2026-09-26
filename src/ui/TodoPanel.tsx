// Pinned, editable todo list above the side panel composer (port of the
// desktop app's TodoPanel). The list is the agent's latest TodoWrite call (see
// latestTodos); user edits live in a local draft until handed back to the
// agent with "Send to agent". Callers key it by conversation to reset the draft.
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Circle, CircleDot, GripVertical, Plus, Send, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { Msg } from "../shared/agui";
import { advanceTodo, latestTodos, moveTodo, todoHandoff, todosDiffer, type Todo } from "../shared/todos";

const STATUS_ICON = { pending: Circle, in_progress: CircleDot, completed: Check } as const;
const STATUS_CLASS = { pending: "text-muted-foreground", in_progress: "text-indigo-500", completed: "text-emerald-500" } as const;

const ROW_BUTTON =
  "shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30";

export function TodoPanel({ messages, canSend, onSend }: { messages: Msg[]; canSend: boolean; onSend: (content: string) => void }) {
  const agentTodos = latestTodos(messages);
  const [draft, setDraft] = useState<Todo[] | null>(null);
  const shown = draft ?? agentTodos;
  const dirty = draft !== null && todosDiffer(draft, agentTodos);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [dropAt, setDropAt] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  // "+ Todo" opens the empty panel for its add input.
  const [adding, setAdding] = useState(false);
  // The agent list the draft was edited from.
  const draftBase = useRef<Todo[]>([]);

  // The agent's TodoWrite is the source of truth: any list it writes after
  // the draft started (an answer to a hand-off, or its own progress)
  // supersedes the draft, so a stale draft never masks the agent's list.
  useEffect(() => {
    if (draft !== null && todosDiffer(draftBase.current, agentTodos)) setDraft(null);
  }, [draft, agentTodos]);

  const edit = (next: Todo[]) => {
    if (draft === null) draftBase.current = agentTodos;
    setDraft(next);
  };

  // An empty list has nothing to show - unless the user just deleted every
  // todo, which still needs "Send to agent" to clear the agent's list.
  if (shown.length === 0 && !adding && !dirty) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label="Add todo"
        className="mb-1.5 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3" /> Todo
      </button>
    );
  }

  const move = (from: number, to: number) => edit(moveTodo(shown, from, to));

  const add = () => {
    const content = input.trim();
    if (!content) return;
    setInput("");
    setAdding(false);
    edit([...shown, { content, status: "pending" }]);
  };

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-card text-xs shadow-sm">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle todo panel"
          className="flex items-center gap-1.5 font-semibold text-foreground/90 hover:text-foreground"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
          Todos ({shown.length})
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => onSend(todoHandoff(shown))}
            disabled={!canSend}
            title={canSend ? "Send this list to the agent" : "Wait for the agent to finish (and stay connected)"}
            className="ml-auto flex items-center gap-1 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 px-2 py-0.5 text-white hover:opacity-90 disabled:cursor-default disabled:opacity-50"
          >
            <Send className="size-3" /> Send to agent
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-border/60">
          <ul className="max-h-[40vh] overflow-y-auto">
            {shown.map((t, i) => {
              const StatusIcon = STATUS_ICON[t.status];
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-1 border-b border-border/60 px-1.5 py-1 last:border-b-0",
                    // Insertion indicator: move(from, i) lands the row after
                    // the hovered row when dragging down, before it when
                    // dragging up - mark exactly that edge.
                    dropAt === i &&
                      dragFrom.current !== null &&
                      dragFrom.current !== i &&
                      (i > dragFrom.current
                        ? "shadow-[inset_0_-2px_0_0_var(--color-indigo-500)]"
                        : "shadow-[inset_0_2px_0_0_var(--color-indigo-500)]"),
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropAt(i);
                  }}
                  onDrop={() => {
                    if (dragFrom.current !== null) move(dragFrom.current, i);
                    dragFrom.current = null;
                    setDropAt(null);
                  }}
                >
                  <span
                    draggable
                    aria-hidden="true"
                    onDragStart={(e) => {
                      dragFrom.current = i;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(i));
                    }}
                    onDragEnd={() => setDropAt(null)}
                    className="cursor-grab text-muted-foreground"
                  >
                    <GripVertical className="size-3" />
                  </span>
                  <button
                    type="button"
                    onClick={() => edit(advanceTodo(shown, i))}
                    aria-label={`Todo status: ${t.status}`}
                    title={`${t.status} - click to advance`}
                    className={cn(ROW_BUTTON, STATUS_CLASS[t.status])}
                  >
                    <StatusIcon className="size-3.5" />
                  </button>
                  <input
                    value={t.content}
                    onChange={(e) => edit(shown.map((it, j) => (j === i ? { ...it, content: e.target.value } : it)))}
                    aria-label="Todo content"
                    title={t.content}
                    className={cn(
                      "min-w-0 flex-1 bg-transparent py-0.5 outline-none",
                      t.status === "completed" && "text-muted-foreground line-through",
                    )}
                  />
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move todo up" className={ROW_BUTTON}>
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === shown.length - 1}
                    aria-label="Move todo down"
                    className={ROW_BUTTON}
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => edit(shown.filter((_, j) => j !== i))} aria-label="Delete todo" className={ROW_BUTTON}>
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1">
            <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={input}
              autoFocus={adding}
              onBlur={() => shown.length === 0 && !input.trim() && setAdding(false)}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder="Add a todo and press Enter"
              aria-label="Add a todo"
              className="min-w-0 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}
    </div>
  );
}
