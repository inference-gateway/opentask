import { beforeEach, describe, expect, test } from "bun:test";
import { backoffMs, isClearCommand, isVisibleMessage, parseConversations, parseEvent, parseFrame, parseHistory, parseQuestions, pendingInterrupts, reduceAgui, runningFromEvent, snapshotToMessages, stripAnsi, toolLabel, type Msg } from "../src/shared/agui";
import { __reset, __setSocket, callTool, handleFrame, panelState, runCommand, sendUserMessage } from "../src/lib/bridge";

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
  test("a run arms the loader and its terminal event clears it", () => {
    expect(runningFromEvent(false, { type: "RUN_STARTED", runId: "r1" })).toBe(true);
    expect(runningFromEvent(true, { type: "RUN_FINISHED", runId: "r1" })).toBe(false);
    expect(runningFromEvent(true, { type: "RUN_ERROR", runId: "r1", message: "x" })).toBe(false);
  });

  test("a RUN_ERROR without a runId is a routing error that ends no run", () => {
    expect(runningFromEvent(true, { type: "RUN_ERROR", message: "no thread" })).toBe(true);
    expect(runningFromEvent(false, { type: "RUN_ERROR", message: "no thread" })).toBe(false);
  });

  test("runs carrying the extension's own tool_request id never arm the loader", () => {
    const self = new Set(["ext-1"]);
    expect(runningFromEvent(false, { type: "RUN_STARTED", runId: "ext-1" }, self)).toBe(false);
    expect(runningFromEvent(false, { type: "RUN_STARTED", runId: "agent-1" }, self)).toBe(true);
  });

  test("streaming and tool events preserve the current flag", () => {
    expect(runningFromEvent(true, { type: "TEXT_MESSAGE_END" })).toBe(true);
    expect(runningFromEvent(false, { type: "TOOL_CALL_START" })).toBe(false);
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
    expect(parseFrame('{"type":"browser_hello_ack","protocol_version":2}')).toEqual({
      type: "browser_hello_ack",
      protocol_version: 2,
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

describe("parseEvent", () => {
  test("accepts the standard events the CLI writes", () => {
    const ev = parseEvent({ type: "RUN_FINISHED", threadId: "t", runId: "r", outcome: { type: "interrupt", interrupts: [{ id: "c1", reason: "tool_call", toolCallId: "c1" }] } });
    expect(String(ev?.type)).toBe("RUN_FINISHED");
    expect(String(parseEvent({ type: "CUSTOM", name: "approval_request", value: { tool_call_id: "x" } })?.type)).toBe("CUSTOM");
  });

  test("rejects app frames and malformed events", () => {
    expect(parseEvent({ type: "conversations", conversations: [] })).toBeUndefined();
    expect(parseEvent({ type: "RUN_STARTED" })).toBeUndefined();
  });
});

describe("parseQuestions", () => {
  test("reads the AskUserQuestion args", () => {
    const args = JSON.stringify({ questions: [{ header: "Lib", question: "Which?", options: [{ label: "a", description: "first" }, { label: "b" }], multiSelect: true }] });
    expect(parseQuestions(args)).toEqual([{ header: "Lib", question: "Which?", options: [{ label: "a", description: "first" }, { label: "b", description: "" }], multiSelect: true }]);
  });

  test("is empty for other args or junk", () => {
    expect(parseQuestions('{"command":"ls"}')).toEqual([]);
    expect(parseQuestions("{")).toEqual([]);
    expect(parseQuestions(undefined)).toEqual([]);
  });
});

describe("pendingInterrupts", () => {
  const rows: Msg[] = [
    { role: "tool", content: "Bash", args: '{"command":"ls"}', id: "c1" },
    { role: "tool", content: "AskUserQuestion", args: JSON.stringify({ questions: [{ question: "Which?", options: [{ label: "a" }] }] }), id: "q1" },
  ];

  test("an approval takes name and args from the run's tool row", () => {
    expect(pendingInterrupts([{ id: "c1", reason: "tool_call", toolCallId: "c1" }], rows)).toEqual([
      { id: "c1", reason: "tool_call", toolName: "Bash", toolArgs: '{"command":"ls"}' },
    ]);
  });

  test("a question takes its questions from the AskUserQuestion row", () => {
    const [q] = pendingInterrupts([{ id: "q1", reason: "input_required", responseSchema: {} }], rows);
    expect(q).toMatchObject({ id: "q1", reason: "input_required" });
    expect(q.reason === "input_required" && q.questions[0].question).toBe("Which?");
  });

  test("unknown reasons are dropped", () => {
    expect(pendingInterrupts([{ id: "z", reason: "other" }], rows)).toEqual([]);
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
  test("rebuilds tool rows from assistant toolCalls and attaches tool messages as results", () => {
    const msgs = snapshotToMessages([
      { id: "1", role: "user", content: "ls please" },
      { id: "2", role: "assistant", content: "", toolCalls: [{ id: "t1", type: "function", function: { name: "Bash", arguments: "{\"command\":\"ls\"}" } }] },
      { id: "3", role: "tool", content: "a.txt\nb.txt", toolCallId: "t1" },
      { id: "4", role: "assistant", content: "Two files." },
    ]);
    expect(msgs).toEqual([
      { role: "user", content: "ls please" },
      { role: "tool", content: "Bash", args: "{\"command\":\"ls\"}", id: "t1", ok: true, error: undefined, result: "a.txt\nb.txt" },
      { role: "assistant", content: "Two files." },
    ]);
  });

  test("a tool message with error marks its row failed, an orphan one is kept as text", () => {
    const msgs = snapshotToMessages([
      { id: "2", role: "assistant", content: "", toolCalls: [{ id: "t1", type: "function", function: { name: "Bash", arguments: "{}" } }] },
      { id: "3", role: "tool", content: "boom", toolCallId: "t1", error: "exit 1" },
      { id: "5", role: "tool", content: "Performed read", toolCallId: "zzz" },
    ]);
    expect(msgs[0]).toMatchObject({ content: "Bash", ok: false, error: "exit 1", result: "boom" });
    expect(msgs[1]).toEqual({ role: "tool", content: "Performed read" });
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

// A fake socket capturing the frames the bridge sends.
function fakeSocket(sent: Record<string, unknown>[]): WebSocket {
  return { readyState: 1, send: (data: string) => sent.push(JSON.parse(data)) } as unknown as WebSocket;
}

function stubChrome() {
  (globalThis as Record<string, unknown>).chrome = {
    windows: { getLastFocused: async () => undefined },
    action: { setBadgeText: async () => undefined, setBadgeBackgroundColor: async () => undefined },
    notifications: { create: async () => undefined, clear: async () => undefined },
  };
}

async function frame(socket: WebSocket, f: Record<string, unknown>) {
  await handleFrame(socket, JSON.stringify(f));
}

describe("handleFrame on the daemon binding", () => {
  let sent: Record<string, unknown>[];
  let socket: WebSocket;

  beforeEach(() => {
    stubChrome();
    sent = [];
    socket = fakeSocket(sent);
    __reset({ projectDir: "/proj" });
    __setSocket(socket);
  });

  test("the ack lists the project's data and a mismatched protocol version asks for an update", async () => {
    await frame(socket, { type: "browser_hello_ack", protocol_version: 2 });
    expect(panelState().connected).toBe(true);
    expect(panelState().updateRequired).toBe(false);
    expect(sent.map((f) => f.type)).toEqual(["list_conversations", "list_skills", "list_models", "list_history"]);
    expect(sent[0].project_dir).toBe("/proj");

    await frame(socket, { type: "browser_hello_ack", protocol_version: 1 });
    expect(panelState().updateRequired).toBe(true);
  });

  test("the hello ack without a project dir sends nothing thread-bound", async () => {
    __reset();
    await frame(socket, { type: "browser_hello_ack", protocol_version: 2 });
    expect(sent).toEqual([]);
    expect(panelState().projectDir).toBeUndefined();
  });

  test("RUN_STARTED adopts the threadId as the active conversation and the terminal event clears busy", async () => {
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r1" });
    expect(panelState()).toMatchObject({ activeConversationId: "s1", running: true });
    expect(sent.at(-1)).toMatchObject({ type: "list_conversations", project_dir: "/proj" });
    await frame(socket, { type: "RUN_FINISHED", threadId: "s1", runId: "r1", outcome: { type: "cancelled" } });
    expect(panelState().running).toBe(false);
  });

  test("a prompt is a run_agent_input on the active thread, with attachments as content parts", async () => {
    await frame(socket, { type: "browser_hello_ack", protocol_version: 2 });
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r0" });
    sent.length = 0;
    expect(sendUserMessage("look", [{ filename: "a.png", mime_type: "image/png", data: "AAAA" }])).toBe(true);
    expect(sent[0]).toMatchObject({ type: "run_agent_input", input: { threadId: "s1", messages: [{ role: "user" }] } });
    const input = sent[0].input as { messages: { content: unknown }[]; runId: string };
    expect(input.messages[0].content).toEqual([{ type: "text", text: "look" }, { type: "image", mimeType: "image/png", data: "AAAA", filename: "a.png" }]);
    expect(input.runId).not.toBe("");
    expect(panelState().running).toBe(true);
  });

  test("a prompt without a thread opens a new session in the project first", async () => {
    await frame(socket, { type: "browser_hello_ack", protocol_version: 2 });
    sent.length = 0;
    sendUserMessage("hi");
    expect(sent.map((f) => f.type)).toEqual(["new_session", "run_agent_input"]);
    expect(sent[0].project_dir).toBe("/proj");
  });

  test("MESSAGES_SNAPSHOT replaces the transcript and ends busy", async () => {
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r1" });
    await frame(socket, { type: "MESSAGES_SNAPSHOT", messages: [{ id: "1", role: "user", content: "hello" }] });
    expect(panelState()).toMatchObject({ running: false, messages: [{ role: "user", content: "hello" }] });
  });

  test("an interrupt shows the approval and the answer is one resume covering it", async () => {
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r1" });
    await frame(socket, { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "Bash" });
    await frame(socket, { type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: '{"command":"ls"}' });
    await frame(socket, { type: "RUN_FINISHED", threadId: "s1", runId: "r1", outcome: { type: "interrupt", interrupts: [{ id: "c1", reason: "tool_call", toolCallId: "c1" }] } });
    expect(panelState().pendingApproval).toEqual({ id: "c1", source: "interrupt", toolName: "Bash", toolArgs: '{"command":"ls"}' });
    expect(panelState().running).toBe(false);
  });

  test("a question interrupt shows the form built from the AskUserQuestion args", async () => {
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r1" });
    await frame(socket, { type: "TOOL_CALL_START", toolCallId: "q1", toolCallName: "AskUserQuestion" });
    await frame(socket, { type: "TOOL_CALL_ARGS", toolCallId: "q1", delta: JSON.stringify({ questions: [{ question: "Which?", options: [{ label: "a" }] }] }) });
    await frame(socket, { type: "RUN_FINISHED", threadId: "s1", runId: "r1", outcome: { type: "interrupt", interrupts: [{ id: "q1", reason: "input_required", responseSchema: {} }] } });
    expect(panelState().pendingQuestion).toMatchObject({ id: "q1", questions: [{ question: "Which?" }] });
    expect(panelState().pendingApproval).toBeUndefined();
  });

  test("a RUN_STARTED after an interrupt clears a prompt another client answered", async () => {
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r1" });
    await frame(socket, { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "Bash" });
    await frame(socket, { type: "RUN_FINISHED", threadId: "s1", runId: "r1", outcome: { type: "interrupt", interrupts: [{ id: "c1", reason: "tool_call", toolCallId: "c1" }] } });
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r2" });
    expect(panelState().pendingApproval).toBeUndefined();
    expect(panelState().running).toBe(true);
  });

  test("a RUN_ERROR without a runId is shown as an error and ends no run", async () => {
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: "r1" });
    await frame(socket, { type: "RUN_ERROR", message: "project_dir must be absolute" });
    expect(panelState().running).toBe(true);
    expect(panelState().messages.at(-1)).toEqual({ role: "assistant", content: "⚠ project_dir must be absolute" });
  });

  test("a run carrying the extension's own tool_request id never arms the loader", async () => {
    await frame(socket, { type: "browser_hello_ack", protocol_version: 2 });
    const p = callTool("Bash", { command: "gh api user" });
    const id = (sent.at(-1) as { id: string }).id;
    await frame(socket, { type: "RUN_STARTED", threadId: "s1", runId: id });
    expect(panelState().running).toBe(false);
    await frame(socket, { type: "tool_result", id, success: true, output: "ok", error: "" });
    expect(await p).toEqual({ success: true, output: "ok", error: "" });
  });

  test("a panel tool_request's CUSTOM approval is shown and cleared by approval_resolved", async () => {
    await frame(socket, { type: "CUSTOM", name: "approval_request", value: { tool_call_id: "t9", tool_name: "Bash", tool_args: "{}" } });
    expect(panelState().pendingApproval).toEqual({ id: "t9", source: "tool_request", toolName: "Bash", toolArgs: "{}" });
    await frame(socket, { type: "CUSTOM", name: "approval_resolved", value: { tool_call_id: "t9" } });
    expect(panelState().pendingApproval).toBeUndefined();
  });

  test("old envelope frames are ignored", async () => {
    await frame(socket, { type: "chat_event", event: { type: "RUN_STARTED", threadId: "s1", runId: "r1" } });
    await frame(socket, { type: "interrupted" });
    await frame(socket, { type: "conversation_snapshot", messages: [{ role: "user", content: "x" }] });
    expect(panelState()).toMatchObject({ running: false, activeConversationId: undefined, messages: [] });
  });
});
