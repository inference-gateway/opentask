import { describe, expect, test } from "bun:test";
import { approvalShortcut } from "../src/lib/utils";

// Minimal KeyboardEvent stand-in: approvalShortcut only reads key, repeat,
// modifier flags, and the target's tagName/isContentEditable.
function keyEvent(init: Record<string, unknown> = {}): KeyboardEvent {
  return {
    key: "a",
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    ...init,
  } as KeyboardEvent;
}

describe("approvalShortcut", () => {
  test("a approves", () => {
    const seen: string[] = [];
    expect(approvalShortcut(keyEvent(), (a) => seen.push(a))).toBe(true);
    expect(seen).toEqual(["approve"]);
  });

  test("d denies", () => {
    const seen: string[] = [];
    expect(approvalShortcut(keyEvent({ key: "d" }), (a) => seen.push(a))).toBe(true);
    expect(seen).toEqual(["reject"]);
  });

  test("shift/caps-lock variants still respond", () => {
    const seen: string[] = [];
    approvalShortcut(keyEvent({ key: "A", shiftKey: true }), (a) => seen.push(a));
    approvalShortcut(keyEvent({ key: "D", shiftKey: true }), (a) => seen.push(a));
    expect(seen).toEqual(["approve", "reject"]);
  });

  test("other keys are ignored", () => {
    expect(approvalShortcut(keyEvent({ key: "x" }), () => {})).toBe(false);
  });

  test("auto-repeat, modifier combos and editable targets are ignored", () => {
    for (const bad of [
      { repeat: true },
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { target: { tagName: "INPUT" } },
      { target: { tagName: "TEXTAREA" } },
      { target: { tagName: "SELECT" } },
      { target: { isContentEditable: true } },
    ]) {
      const seen: string[] = [];
      expect(approvalShortcut(keyEvent(bad), (a) => seen.push(a))).toBe(false);
      expect(seen).toEqual([]);
    }
  });
});