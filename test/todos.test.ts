import { describe, expect, test } from "bun:test";
import type { Msg } from "../src/shared/agui";
import { advanceTodo, latestTodos, moveTodo, parseTodos, todoHandoff, todosDiffer, todoSummary, type Todo } from "../src/shared/todos";

const todoArgs = JSON.stringify({
  todos: [
    { content: "branch", status: "completed" },
    { content: "render visual", status: "in_progress" },
    { content: "tests", status: "pending" },
  ],
});

const a: Todo = { content: "a", status: "pending" };
const b: Todo = { content: "b", status: "in_progress" };
const c: Todo = { content: "c", status: "completed" };

describe("parseTodos", () => {
  test("parses TodoWrite args into items with status", () => {
    expect(parseTodos("TodoWrite", todoArgs)).toEqual([
      { content: "branch", status: "completed" },
      { content: "render visual", status: "in_progress" },
      { content: "tests", status: "pending" },
    ]);
  });

  test("tolerates common text field names and a bare array; unknown status reads pending", () => {
    expect(parseTodos("TodoWrite", '[{"text":"a"},{"subject":"b","status":"completed"},{"task":"c","status":"weird"}]')).toEqual([
      { content: "a", status: "pending" },
      { content: "b", status: "completed" },
      { content: "c", status: "pending" },
    ]);
  });

  test("falls back on partial JSON, a wrong shape, or a non-todo tool", () => {
    expect(parseTodos("TodoWrite", '{"todos":[{"content":"a"')).toBeUndefined();
    expect(parseTodos("TodoWrite", '{"command":"ls"}')).toBeUndefined();
    expect(parseTodos("TodoWrite", '{"todos":["plain"]}')).toBeUndefined();
    expect(parseTodos("Bash", todoArgs)).toBeUndefined();
    expect(parseTodos("TodoWrite")).toBeUndefined();
  });

  test("an explicit empty list parses as cleared", () => {
    expect(parseTodos("TodoWrite", '{"todos":[]}')).toEqual([]);
    expect(todoSummary([])).toBe("cleared");
  });

  test("todoSummary counts done and names the in-progress item", () => {
    expect(todoSummary(parseTodos("TodoWrite", todoArgs)!)).toBe("1/3 done · render visual");
    expect(todoSummary([c, { ...c, content: "d" }])).toBe("2/2 done");
  });
});

describe("latestTodos", () => {
  const write = (todos: Todo[]): Msg => ({ role: "tool", content: "TodoWrite", args: JSON.stringify({ todos }) });

  test("the latest todo-list call wins", () => {
    expect(latestTodos([write([a]), { role: "assistant", content: "ok" }, write([b, c])])).toEqual([b, c]);
  });

  test("a mid-stream partial call falls back to the previous list", () => {
    expect(latestTodos([write([a]), { role: "tool", content: "TodoWrite", args: '{"todos":[{"con' }])).toEqual([a]);
  });

  test("an agent clearing its list empties it", () => {
    expect(latestTodos([write([a]), write([])])).toEqual([]);
  });

  test("a call the CLI rejected falls back to the previous list", () => {
    expect(latestTodos([write([a]), { ...write([]), ok: false }])).toEqual([a]);
  });

  test("is empty without any todo-list call", () => {
    expect(latestTodos([{ role: "tool", content: "Bash", args: '{"command":"ls"}' }, { role: "user", content: "TodoWrite" }])).toEqual([]);
  });
});

describe("todosDiffer", () => {
  test("detects reorder, status change and length change; equal lists match", () => {
    expect(todosDiffer([a, b], [a, b])).toBe(false);
    expect(todosDiffer([a, b], [b, a])).toBe(true);
    expect(todosDiffer([a], [{ ...a, status: "completed" }])).toBe(true);
    expect(todosDiffer([a], [a, b])).toBe(true);
  });
});

describe("moveTodo", () => {
  test("moves a todo up or down", () => {
    expect(moveTodo([a, b, c], 2, 0)).toEqual([c, a, b]);
    expect(moveTodo([a, b, c], 0, 1)).toEqual([b, a, c]);
  });

  test("returns the same list for no-op or out-of-range moves", () => {
    const list = [a, b];
    expect(moveTodo(list, 0, 0)).toBe(list);
    expect(moveTodo(list, 0, -1)).toBe(list);
    expect(moveTodo(list, 1, 2)).toBe(list);
  });
});

describe("advanceTodo", () => {
  test("cycles pending -> in_progress -> completed -> pending on one todo only", () => {
    expect(advanceTodo([a, c], 0)).toEqual([{ ...a, status: "in_progress" }, c]);
    expect(advanceTodo([b], 0)[0].status).toBe("completed");
    expect(advanceTodo([c], 0)[0].status).toBe("pending");
  });
});

describe("todoHandoff", () => {
  test("hands the list to TodoWrite in its {content, status} schema, dropping blank todos", () => {
    const msg = todoHandoff([b, { content: "  ", status: "pending" }, a]);
    expect(msg).toStartWith("Update the session todo list to exactly the following by calling the TodoWrite tool");
    expect(JSON.parse(msg.slice(msg.indexOf("\n") + 1))).toEqual({ todos: [b, a] });
  });

  test("an empty (or all-blank) list hands off a clear", () => {
    for (const todos of [[], [{ content: " ", status: "pending" as const }]]) {
      const msg = todoHandoff(todos);
      expect(JSON.parse(msg.slice(msg.indexOf("\n") + 1))).toEqual({ todos: [] });
    }
  });
});
