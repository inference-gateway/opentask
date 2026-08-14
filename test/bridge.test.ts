import { describe, expect, test } from "bun:test";
import { approvalFromFrame, backoffMs, parseFrame, reduceAgui, type Msg } from "../src/shared/agui";

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
      { role: "tool", content: "BrowserNavigate" },
    ]);
  });

  test("unknown events leave messages unchanged (same reference)", () => {
    const m: Msg[] = [{ role: "user", content: "q" }];
    expect(reduceAgui(m, { type: "RUN_STARTED" })).toBe(m);
    expect(reduceAgui(m, null)).toBe(m);
    expect(reduceAgui(m, { delta: "no type" })).toBe(m);
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
