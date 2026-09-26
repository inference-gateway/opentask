// The session todo list the agent keeps through its TodoWrite tool, plus the
// user's edits to it before handing it back. Names follow the CLI's TodoWrite
// schema ({content, status}), shared with the desktop app, so a todo means the
// same thing in the CLI, the desktop app and this panel.
import type { Msg } from "./agui";

export type TodoStatus = "pending" | "in_progress" | "completed";
export type Todo = { content: string; status: TodoStatus };

const STATUS_CYCLE: TodoStatus[] = ["pending", "in_progress", "completed"];

// Translates a todo-list tool call's args JSON into Todos: `{"todos":[…]}` (or a
// bare array) whose items carry text under content/text/subject/task (other
// agents' todo tools) and a status of completed/in_progress (anything else
// reads as pending). An explicit empty list parses as [] (the list was
// cleared). Returns undefined — the caller falls back to the plain pill — for
// a non-todo tool, unparseable (mid-stream partial) args, or a non-todo shape.
export function parseTodos(name: string, args?: string): Todo[] | undefined {
  if (!args || !name.toLowerCase().includes("todo")) return undefined;
  let o: unknown;
  try {
    o = JSON.parse(args);
  } catch {
    return undefined;
  }
  const list = Array.isArray(o) ? o : (o as { todos?: unknown } | null)?.todos;
  if (!Array.isArray(list)) return undefined;
  const todos = list.flatMap((raw): Todo[] => {
    const t = raw as { content?: unknown; text?: unknown; subject?: unknown; task?: unknown; status?: unknown };
    const content = [t?.content, t?.text, t?.subject, t?.task].find((v) => typeof v === "string" && v !== "");
    if (typeof content !== "string") return [];
    const status = t?.status === "completed" ? "completed" : t?.status === "in_progress" ? "in_progress" : "pending";
    return [{ content, status }];
  });
  return todos.length > 0 || list.length === 0 ? todos : undefined;
}

// One-line collapsed summary for a todo list: "2/5 done · <in-progress item>".
export function todoSummary(todos: Todo[]): string {
  if (todos.length === 0) return "cleared";
  const done = todos.filter((t) => t.status === "completed").length;
  const current = todos.find((t) => t.status === "in_progress");
  return `${done}/${todos.length} done` + (current ? ` · ${current.content}` : "");
}

// The agent's current list: its latest todo-list tool call the CLI didn't
// reject. Scanning backwards lets partially-streamed args and failed calls
// fall through to the previous list instead of blanking the pinned panel.
export function latestTodos(messages: Msg[]): Todo[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const todos = m.role === "tool" && m.ok !== false ? parseTodos(m.content, m.args) : undefined;
    if (todos) return todos;
  }
  return [];
}

// User edits are unsent while they differ from the agent's list.
export function todosDiffer(a: Todo[], b: Todo[]): boolean {
  return a.length !== b.length || a.some((t, i) => t.content !== b[i].content || t.status !== b[i].status);
}

// Reorders one todo; out-of-range or no-op moves return the list unchanged.
export function moveTodo(todos: Todo[], from: number, to: number): Todo[] {
  if (from === to || from < 0 || to < 0 || from >= todos.length || to >= todos.length) return todos;
  const next = [...todos];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Advances one todo's status: pending -> in_progress -> completed -> pending.
export function advanceTodo(todos: Todo[], i: number): Todo[] {
  return todos.map((t, j) => (j === i ? { ...t, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(t.status) + 1) % STATUS_CYCLE.length] } : t));
}

// The user message handing an edited list back to the agent (same wording as
// the desktop app). Blank todos are dropped; an empty list clears it.
export function todoHandoff(todos: Todo[]): string {
  const list = todos.filter((t) => t.content.trim());
  return `Update the session todo list to exactly the following by calling the TodoWrite tool now with this argument:\n${JSON.stringify({ todos: list })}`;
}
