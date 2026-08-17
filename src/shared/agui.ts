// Pure helpers for the CLI browser-bridge (issue #141). The wire contract lives in
// inference-gateway/cli docs/browser-extension-protocol.md; unknown frame/event
// types must be ignored.

// `args` accumulates the tool call's TOOL_CALL_ARGS deltas (raw JSON) for the
// tool role; other roles leave it unset.
export type Msg = { role: string; content: string; args?: string };

// Folds one AG-UI chat_event into the rendered message list. Text streaming and
// tool calls (name + args) are rendered; everything else is a no-op by contract.
export function reduceAgui(messages: Msg[], event: unknown): Msg[] {
  const e = event as { type?: unknown; role?: string; delta?: string; toolCallName?: string } | null;
  if (!e || typeof e.type !== "string") return messages;
  switch (e.type) {
    case "TEXT_MESSAGE_START":
      return [...messages, { role: e.role ?? "assistant", content: "" }];
    case "TEXT_MESSAGE_CONTENT": {
      const last = messages[messages.length - 1];
      if (!last || last.role === "user")
        return [...messages, { role: "assistant", content: e.delta ?? "" }];
      return [...messages.slice(0, -1), { ...last, content: last.content + (e.delta ?? "") }];
    }
    case "TOOL_CALL_START":
      return [...messages, { role: "tool", content: e.toolCallName ?? "tool", args: "" }];
    case "TOOL_CALL_ARGS": {
      // START→ARGS→END stream contiguously, so the last message is this tool call.
      const last = messages[messages.length - 1];
      if (last?.role !== "tool") return messages;
      return [...messages.slice(0, -1), { ...last, args: (last.args ?? "") + (e.delta ?? "") }];
    }
    default:
      return messages;
  }
}

// Per-turn busy flag from the AG-UI stream. Over the bridge, RUN_STARTED/
// RUN_FINISHED bracket the whole connection (not a turn), so they can't drive
// the loader. Key off turn-level events instead: a tool call means work is
// running (stays true through a long tool execution that emits nothing), and an
// assistant message ending winds the turn down — a following tool call re-arms it.
export function runningFromEvent(current: boolean, event: unknown): boolean {
  const t = (event as { type?: unknown } | null)?.type;
  if (t === "TOOL_CALL_START") return true;
  if (t === "TEXT_MESSAGE_END") return false;
  return current;
}

// toolLabel renders a tool pill as "Name(key=value, …)", falling back to the
// bare name when there are no args and to the raw args string when they are not
// valid JSON (e.g. a mid-stream partial). The caller truncates for display.
export function toolLabel(name: string, args?: string): string {
  if (!args) return name;
  try {
    const o = JSON.parse(args) as Record<string, unknown>;
    const inner = Object.entries(o).map(([k, v]) => `${k}=${String(v)}`).join(", ");
    return `${name}(${inner})`;
  } catch {
    return `${name}(${args})`;
  }
}

// Hides messages the panel shouldn't render: empty content, the system prompt,
// and injected <system-reminder> context. Filters the outbound view only.
export function isVisibleMessage(m: Msg): boolean {
  const c = m.content.trim();
  if (!c) return false;
  if (m.role === "system") return false;
  if (c.startsWith("<system-reminder>")) return false;
  return true;
}

// Strips ANSI escape sequences (SGR colors, cursor/clear controls) from CLI text
// so status/spinner lines render clean. Pattern from the ansi-regex package.
const ANSI = /[\x1b\x9b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

// Reconnect backoff: 1s, 2s, 4s ... capped at 30s.
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** attempt);
}

export function isClearCommand(content: string): boolean {
  const c = content.trim().toLowerCase();
  return c === "/clear" || c === "/cls";
}

// One wire frame per WS text message; garbage is ignored, not thrown.
export function parseFrame(data: unknown): Record<string, unknown> | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const v = JSON.parse(data);
    return v && typeof v === "object" && !Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

// A stored CLI conversation the panel can resume (protocol v4 `conversations`).
export type ConversationMeta = { id: string; title: string; updatedAt: string; messageCount: number };

// Parses a `conversations` wire frame into ConversationMeta[], mapping snake_case
// wire fields and dropping entries without a usable string id.
export function parseConversations(frame: Record<string, unknown>): ConversationMeta[] {
  const list = frame.conversations;
  if (!Array.isArray(list)) return [];
  return list.flatMap((c) => {
    const o = c as { id?: unknown; title?: unknown; updated_at?: unknown; message_count?: unknown };
    if (typeof o.id !== "string" || o.id === "") return [];
    return [{
      id: o.id,
      title: typeof o.title === "string" ? o.title : "",
      updatedAt: typeof o.updated_at === "string" ? o.updated_at : "",
      messageCount: typeof o.message_count === "number" ? o.message_count : 0,
    }];
  });
}

// A skill the panel offers in the "/" menu (protocol `skills` frame). `scope` is
// the CLI SkillScope: project | agents | user | plugin | catalog.
export type PanelSkill = { name: string; description: string; scope: string };

// Parses a `skills` wire frame into PanelSkill[], dropping entries without a
// usable string name.
export function parseSkills(frame: Record<string, unknown>): PanelSkill[] {
  const list = frame.skills;
  if (!Array.isArray(list)) return [];
  return list.flatMap((s) => {
    const o = s as { name?: unknown; description?: unknown; scope?: unknown };
    if (typeof o.name !== "string" || o.name === "") return [];
    return [{
      name: o.name,
      description: typeof o.description === "string" ? o.description : "",
      scope: typeof o.scope === "string" ? o.scope : "",
    }];
  });
}

// SW <-> side-panel Port protocol ("bridge-panel").
export type PendingApproval = { requestId: string; toolName: string; toolArgs: string };

// Parses an approval_request wire frame into a PendingApproval, or undefined
// when it lacks a usable request id (nothing to answer).
export function approvalFromFrame(frame: Record<string, unknown>): PendingApproval | undefined {
  if (typeof frame.request_id !== "string" || frame.request_id === "") return undefined;
  return {
    requestId: frame.request_id,
    toolName: typeof frame.tool_name === "string" ? frame.tool_name : "",
    toolArgs: typeof frame.tool_args === "string" ? frame.tool_args : "",
  };
}

export type PanelState = {
  type: "state";
  connected: boolean;
  connecting: boolean;
  running: boolean;
  // http://127.0.0.1:<port> — base for loading CLI-served artifacts (images).
  artifactBase: string;
  messages: Msg[];
  conversations: ConversationMeta[];
  skills: PanelSkill[];
  activeConversationId?: string;
  pendingApproval?: PendingApproval;
};
export type PanelConnect = { type: "connect" };
export type PanelDisconnect = { type: "disconnect" };
export type PanelUserMessage = { type: "user_message"; content: string };
export type PanelListConversations = { type: "list_conversations" };
export type PanelResumeConversation = { type: "resume_conversation"; id: string };
export type PanelApproval = {
  type: "approval_response";
  requestId: string;
  action: "approve" | "reject";
};
