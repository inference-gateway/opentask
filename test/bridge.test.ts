import { beforeEach, describe, expect, test } from "bun:test";
import { approvalFromFrame, snapshotToMessages, backoffMs, isClearCommand, isVisibleMessage, parseConversations, parseFrame, parseHistory, reduceAgui, runningFromEvent, stripAnsi, toolLabel, type Msg } from "../src/shared/agui";
import { handleFrame, panelState, runCommand } from "../src/lib/bridge";

describe("reduceAgui", () => {
  test("streams start/content into one assistant message", () => {
    let m: Msg[] = [];
    m = reduceAgui(m, { type: "TEXT_MESSAGE_START", role: "assistant" });
    m = reduceAgui(m, { type: "TEXT_MESSAGE_CONTENT", delta: "Hel" });
    m = reduceAgui(m, { type: "TEXT_MESSAGE_CONTENT", delta: "lo" });
    m = reduceAgui(m, { type: "TEXT_MESSAGE_END" });
    expect(m).toEqual([{ role: "assistant", content: "Hello" }]);
  });

  test("content without a prior start creates an assistant message", () => {
    expect(reduceAgui([], { type: "TEXT_MESSAGE_CONTENT", delta: "hi" })).toEqual([
      { role: "assistant", content: "hi" },
    ]);
  });

  test("content after a user message starts a fresh assistant message", () => {
    const m = reduceAgui([{ role: "user", content: "q" }], { type: "TEXT_MESSAGE_CONTENT", delta: "a" });
    expect(m).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
    ]);
  });

  test("tool call start renders a tool row", () => {
    expect(reduceAgui([], { type: "TOOL_CALL_START", toolCallName: "BrowserNavigate" })).toEqual([
      { role: "tool", content: "BrowserNavigate", args: "" },
    ]);
  });

  test("tool call args accumulate onto the tool row", () => {
    let m = reduceAgui([], { type: "TOOL_CALL_START", toolCallName: "Write" });
    m = reduceAgui(m, { type: "TOOL_CALL_ARGS", delta: '{"file_path":' });
    m = reduceAgui(m, { type: "TOOL_CALL_ARGS", delta: '"dummy.txt"}' });
    expect(m).toEqual([{ role: "tool", content: "Write", args: '{"file_path":"dummy.txt"}' }]);
  });

  test("streams reasoning start/content into one reasoning message", () => {
    let m: Msg[] = [];
    m = reduceAgui(m, { type: "REASONING_MESSAGE_START", role: "assistant" });
    m = reduceAgui(m, { type: "REASONING_MESSAGE_CONTENT", delta: "I should run " });
    m = reduceAgui(m, { type: "REASONING_MESSAGE_CONTENT", delta: "the tests." });
    m = reduceAgui(m, { type: "REASONING_MESSAGE_END" });
    expect(m).toEqual([{ role: "reasoning", content: "I should run the tests." }]);
  });

  test("reasoning content without a prior start creates a reasoning message", () => {
    expect(reduceAgui([{ role: "user", content: "q" }], { type: "REASONING_MESSAGE_CONTENT", delta: "hm" })).toEqual([
      { role: "user", content: "q" },
      { role: "reasoning", content: "hm" },
    ]);
  });

  test("a tool call after reasoning leaves the reasoning message intact", () => {
    let m: Msg[] = [];
    m = reduceAgui(m, { type: "REASONING_MESSAGE_START" });
    m = reduceAgui(m, { type: "REASONING_MESSAGE_CONTENT", delta: "run it" });
    m = reduceAgui(m, { type: "TOOL_CALL_START", toolCallName: "Bash" });
    expect(m).toEqual([
      { role: "reasoning", content: "run it" },
      { role: "tool", content: "Bash", args: "" },
    ]);
  });

  test("a user message streamed by the CLI (role user on START) renders as a user bubble", () => {
    let m = reduceAgui([], { type: "TEXT_MESSAGE_START", messageId: "u1", role: "user" });
    m = reduceAgui(m, { type: "TEXT_MESSAGE_CONTENT", messageId: "u1", delta: "what's up" });
    m = reduceAgui(m, { type: "TEXT_MESSAGE_END", messageId: "u1" });
    m = reduceAgui(m, { type: "TEXT_MESSAGE_START", messageId: "a1", role: "assistant" });
    m = reduceAgui(m, { type: "TEXT_MESSAGE_CONTENT", messageId: "a1", delta: "not much" });
    expect(m).toEqual([
      { role: "user", content: "what's up", id: "u1" },
      { role: "assistant", content: "not much", id: "a1" },
    ]);
  });

  test("tool result marks the matching tool row ok or failed", () => {
    let m = reduceAgui([], { type: "TOOL_CALL_START", toolCallId: "a", toolCallName: "Bash" });
    m = reduceAgui(m, { type: "TOOL_CALL_START", toolCallId: "b", toolCallName: "Read" });
    m = reduceAgui(m, { type: "TOOL_CALL_RESULT", toolCallId: "a", content: JSON.stringify({ success: false, error: "exit 1" }) });
    m = reduceAgui(m, { type: "TOOL_CALL_RESULT", toolCallId: "b", content: JSON.stringify({ success: true }) });
    expect(m[0]).toMatchObject({ content: "Bash", ok: false, error: "exit 1" });
    expect(m[1]).toMatchObject({ content: "Read", ok: true });
  });

  test("tool result with unknown id falls back to the last tool row; malformed content is a no-op", () => {
    const start = reduceAgui([], { type: "TOOL_CALL_START", toolCallId: "a", toolCallName: "Bash" });
    expect(reduceAgui(start, { type: "TOOL_CALL_RESULT", toolCallId: "zzz", content: "{\"success\":true}" })[0].ok).toBe(true);
    expect(reduceAgui(start, { type: "TOOL_CALL_RESULT", toolCallId: "a", content: "not json" })).toBe(start);
  });

  test("unknown events leave messages unchanged (same reference)", () => {
    const m: Msg[] = [{ role: "user", content: "q" }];
    expect(reduceAgui(m, { type: "RUN_STARTED" })).toBe(m);
    expect(reduceAgui(m, null)).toBe(m);
    expect(reduceAgui(m, { delta: "no type" })).toBe(m);
  });
});

describe("runningFromEvent", () => {
  test("a tool call marks busy, an assistant message ending winds down", () => {
    expect(runningFromEvent(false, { type: "TOOL_CALL_START" })).toBe(true);
    expect(runningFromEvent(true, { type: "TEXT_MESSAGE_END" })).toBe(false);
  });

  test("connection-level RUN events never touch the flag", () => {
    expect(runningFromEvent(false, { type: "RUN_STARTED" })).toBe(false);
    expect(runningFromEvent(true, { type: "RUN_FINISHED" })).toBe(true);
    expect(runningFromEvent(true, { type: "RUN_ERROR" })).toBe(true);
  });

  test("extension-initiated tool calls never arm the loader", () => {
    const self = new Set(["ext-1"]);
    expect(runningFromEvent(false, { type: "TOOL_CALL_START", toolCallId: "ext-1" }, self)).toBe(false);
    expect(runningFromEvent(false, { type: "TOOL_CALL_START", toolCallId: "agent-1" }, self)).toBe(true);
  });

  test("streaming and malformed events preserve the current flag", () => {
    expect(runningFromEvent(true, { type: "TEXT_MESSAGE_CONTENT", delta: "x" })).toBe(true);
    expect(runningFromEvent(true, { type: "TOOL_CALL_ARGS", delta: "{" })).toBe(true);
    expect(runningFromEvent(true, null)).toBe(true);
  });
});

describe("toolLabel", () => {
  test("bare name when no args", () => {
    expect(toolLabel("Write")).toBe("Write");
    expect(toolLabel("Write", "")).toBe("Write");
  });

  test("folds parsed args into Name(key=value)", () => {
    expect(toolLabel("Write", '{"file_path":"dummy.txt"}')).toBe("Write(file_path=dummy.txt)");
  });

  test("falls back to raw args when not valid JSON", () => {
    expect(toolLabel("Write", '{"file_path":')).toBe('Write({"file_path":)');
  });
});

describe("isVisibleMessage", () => {
  test("drops empty content, system role, and system-reminders", () => {
    expect(isVisibleMessage({ role: "assistant", content: "" })).toBe(false);
    expect(isVisibleMessage({ role: "assistant", content: "   " })).toBe(false);
    expect(isVisibleMessage({ role: "system", content: "you are an agent" })).toBe(false);
    expect(isVisibleMessage({ role: "user", content: "<system-reminder>\nctx\n</system-reminder>" })).toBe(false);
  });

  test("keeps normal user, assistant, and tool rows", () => {
    expect(isVisibleMessage({ role: "user", content: "hi" })).toBe(true);
    expect(isVisibleMessage({ role: "assistant", content: "hello" })).toBe(true);
    expect(isVisibleMessage({ role: "tool", content: "BrowserNavigate" })).toBe(true);
  });
});

describe("backoffMs", () => {
  test("doubles from 1s and caps at 30s", () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(4)).toBe(16000);
    expect(backoffMs(5)).toBe(30000);
    expect(backoffMs(50)).toBe(30000);
  });
});

describe("isClearCommand", () => {
  test("matches /clear and /cls regardless of case and surrounding space", () => {
    expect(isClearCommand("/clear")).toBe(true);
    expect(isClearCommand("  /CLEAR  ")).toBe(true);
    expect(isClearCommand("/cls")).toBe(true);
  });

  test("does not match normal messages or lookalikes", () => {
    expect(isClearCommand("hello")).toBe(false);
    expect(isClearCommand("/clearcache")).toBe(false);
    expect(isClearCommand("please /clear")).toBe(false);
    expect(isClearCommand("")).toBe(false);
  });
});

describe("parseFrame", () => {
  test("parses a JSON object frame", () => {
    expect(parseFrame('{"type":"browser_hello_ack","protocol_version":1}')).toEqual({
      type: "browser_hello_ack",
      protocol_version: 1,
    });
  });

  test("ignores garbage, non-strings, and non-objects", () => {
    expect(parseFrame("not json")).toBeUndefined();
    expect(parseFrame(new ArrayBuffer(2))).toBeUndefined();
    expect(parseFrame('"str"')).toBeUndefined();
    expect(parseFrame("[1,2]")).toBeUndefined();
    expect(parseFrame("null")).toBeUndefined();
  });
});

describe("approvalFromFrame", () => {
  test("maps a full approval_request frame", () => {
    expect(
      approvalFromFrame({ type: "approval_request", request_id: "r1", tool_name: "Bash", tool_args: '{"command":"ls"}' }),
    ).toEqual({ requestId: "r1", toolName: "Bash", toolArgs: '{"command":"ls"}' });
  });

  test("defaults missing name/args to empty strings", () => {
    expect(approvalFromFrame({ request_id: "r2" })).toEqual({ requestId: "r2", toolName: "", toolArgs: "" });
  });

  test("returns undefined without a usable request id", () => {
    expect(approvalFromFrame({ tool_name: "Bash" })).toBeUndefined();
    expect(approvalFromFrame({ request_id: "" })).toBeUndefined();
    expect(approvalFromFrame({ request_id: 5 })).toBeUndefined();
  });
});

describe("parseConversations", () => {
  test("maps snake_case wire fields to camelCase ConversationMeta", () => {
    expect(
      parseConversations({
        type: "conversations",
        conversations: [{ id: "a1", title: "Fix login bug", updated_at: "2026-08-16T12:00:00Z", message_count: 12 }],
      }),
    ).toEqual([{ id: "a1", title: "Fix login bug", updatedAt: "2026-08-16T12:00:00Z", messageCount: 12 }]);
  });

  test("drops entries without a usable string id and defaults missing fields", () => {
    expect(
      parseConversations({ conversations: [{ title: "no id" }, { id: "" }, { id: 5 }, { id: "ok" }] }),
    ).toEqual([{ id: "ok", title: "", updatedAt: "", messageCount: 0 }]);
  });

  test("returns [] for a missing or non-array conversations field", () => {
    expect(parseConversations({ type: "conversations" })).toEqual([]);
    expect(parseConversations({ conversations: "nope" })).toEqual([]);
  });
});

describe("stripAnsi", () => {
  test("removes truecolor SGR codes from a status line", () => {
    expect(stripAnsi("\x1b[1;38;2;158;206;106m✓ \x1b[m Generating snippet with AI...")).toBe(
      "✓  Generating snippet with AI...",
    );
  });

  test("removes non-SGR sequences (clear-line, hide-cursor)", () => {
    expect(stripAnsi("\x1b[2K\x1b[?25lhi\x1b[?25h")).toBe("hi");
  });

  test("leaves plain text untouched", () => {
    expect(stripAnsi("no codes here")).toBe("no codes here");
  });
});

describe("snapshotToMessages", () => {
  test("rebuilds tool rows from assistant tool_calls and attaches tool entries as results", () => {
    const msgs = snapshotToMessages({
      messages: [
        { role: "user", content: "ls please" },
        { role: "assistant", content: "", tool_calls: [{ id: "t1", function: { name: "Bash", arguments: "{\"command\":\"ls\"}" } }] },
        { role: "tool", content: "a.txt\nb.txt", tool_call_id: "t1" },
        { role: "assistant", content: "Two files." },
      ],
      tool_results: { t1: true },
    });
    expect(msgs).toEqual([
      { role: "user", content: "ls please" },
      { role: "tool", content: "Bash", args: "{\"command\":\"ls\"}", id: "t1", ok: true, result: "a.txt\nb.txt" },
      { role: "assistant", content: "Two files." },
    ]);
  });

  test("keeps orphan tool entries and drops roleless garbage", () => {
    const msgs = snapshotToMessages({ messages: [{ role: "tool", content: "Performed read", tool_call_id: "zzz" }, { content: "x" }, null] });
    expect(msgs).toEqual([{ role: "tool", content: "Performed read" }]);
  });
});

describe("parseHistory", () => {
  test("keeps string entries oldest-first, drops junk", () => {
    expect(parseHistory({ type: "history", history: ["a", "b", 3, "", null] })).toEqual(["a", "b"]);
    expect(parseHistory({ type: "history" })).toEqual([]);
  });
});

describe("runCommand", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).chrome = {
      tabs: {
        query: async () => [{ id: 7, url: "https://example.com", title: "Example" }],
        get: async () => ({ id: 7, url: "https://example.com", title: "Example" }),
        update: async () => ({}),
      },
      scripting: {
        executeScript: async ({ func, args }: { func: (...a: never[]) => unknown; args: unknown[] }) => {
          try {
            return [{ result: func(...(args as never[])) }];
          } catch {
            return [{ result: undefined }];
          }
        },
      },
    };
  });

  test("a click on a missing element surfaces the error instead of silent success", async () => {
    const result = await runCommand({ type: "browser_command", id: "1", action: "click", selector: "#missing" });
    expect(result.error).toBe("selector not found: #missing");
  });

  test("a click with a Playwright-style selector surfaces the SyntaxError", async () => {
    const result = await runCommand({ type: "browser_command", id: "2", action: "click", selector: 'button:has-text("Comment")' });
    expect(result.error).not.toBe("");
  });

  test("a type on a missing element surfaces the error", async () => {
    const result = await runCommand({ type: "browser_command", id: "3", action: "type", selector: "#missing", text: "hi" });
    expect(result.error).toBe("selector not found: #missing");
  });

  test("a read on a missing element surfaces the error instead of empty content", async () => {
    const result = await runCommand({ type: "browser_command", id: "4", action: "read", selector: "#missing" });
    expect(result.error).toBe("selector not found: #missing");
  });

  test("a read on an existing textarea returns its value", async () => {
    document.body.innerHTML = '<textarea name="note">hello</textarea>';
    const result = await runCommand({ type: "browser_command", id: "5", action: "read", selector: "textarea" });
    expect(result).toMatchObject({ error: "", content: "hello" });
  });

  test("a text= click finds the element by visible text and the click bubbles to a delegated handler", async () => {
    document.body.innerHTML = '<table><tbody><tr class="zA"><td><span class="bog">Data restoration is now open</span></td></tr></tbody></table>';
    let clicked = false;
    document.querySelector("tr")?.addEventListener("click", () => { clicked = true; });
    const result = await runCommand({ type: "browser_command", id: "t7", action: "click", selector: 'text="Data restoration is now open"' });
    expect(clicked).toBe(true);
    expect(result.error).toBe("");
  });

  test("a text= click with no matching text reports selector not found", async () => {
    document.body.innerHTML = "<p>unrelated</p>";
    const result = await runCommand({ type: "browser_command", id: "t8", action: "click", selector: "text=No such subject" });
    expect(result.error).toBe("selector not found: text=No such subject");
  });

  test("a text= type targets the element containing the text", async () => {
    document.body.innerHTML = "<div>Reply here</div>";
    const result = await runCommand({ type: "browser_command", id: "t9", action: "type", selector: "text=Reply here", text: "hi" });
    expect(result.error).toBe("");
    expect(document.querySelector("div")?.textContent).toBe("hi");
  });

  test("a click on an existing element clicks it and reports no error", async () => {
    document.body.innerHTML = '<button id="b"></button>';
    let clicked = false;
    document.getElementById("b")?.addEventListener("click", () => { clicked = true; });
    const result = await runCommand({ type: "browser_command", id: "6", action: "click", selector: "#b" });
    expect(clicked).toBe(true);
    expect(result.error).toBe("");
  });
});

describe("handleFrame interrupted", () => {
  const socket = {} as WebSocket;

  test("an interrupted frame clears the running state", async () => {
    await handleFrame(socket, JSON.stringify({ type: "chat_event", event: { type: "TOOL_CALL_START", toolCallName: "Bash" } }));
    expect(panelState().running).toBe(true);
    await handleFrame(socket, JSON.stringify({ type: "interrupted" }));
    expect(panelState().running).toBe(false);
  });

  test("an interrupted frame while idle keeps running false", async () => {
    await handleFrame(socket, JSON.stringify({ type: "interrupted" }));
    expect(panelState().running).toBe(false);
  });
});
