// Pure helpers for the CLI browser-bridge (issue #141). The wire contract lives in
// inference-gateway/cli docs/browser-extension-protocol.md; unknown frame/event
// types must be ignored.

export type Msg = { role: string; content: string };

// Folds one AG-UI chat_event into the rendered message list. Only text streaming
// and tool-call starts are rendered; everything else is a no-op by contract.
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
    default:
      if (e.type.startsWith("TOOL_CALL_START"))
        return [...messages, { role: "tool", content: e.toolCallName ?? e.type }];
      return messages;
  }
}

// Reconnect backoff: 1s, 2s, 4s ... capped at 30s.
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** attempt);
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
  messages: Msg[];
  pendingApproval?: PendingApproval;
};
export type PanelUserMessage = { type: "user_message"; content: string };
export type PanelApproval = {
  type: "approval_response";
  requestId: string;
  action: "approve" | "reject";
};
