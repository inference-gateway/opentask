// Pure helpers for the infer daemon binding. The wire contract is the Daemon
// Binding Protocol (inference-gateway/cli docs/browser-extension-protocol.md):
// a frame with an uppercase type is a standard AG-UI 1.0 event, validated here
// with the upstream schemas; unknown frame types must be ignored.
import { EventSchema } from "@ag-ui/core/schemas";
import type { Event, Interrupt, Message } from "@ag-ui/core";

export const PROTOCOL_VERSION = 2;

// Validates one wire frame as an AG-UI event with the upstream schema, or
// undefined for an app frame or a malformed event.
export function parseEvent(frame: Record<string, unknown>): Event | undefined {
  const r = EventSchema.safeParse(frame);
  return r.success ? r.data : undefined;
}

// `args` accumulates the tool call's TOOL_CALL_ARGS deltas (raw JSON) for the
// tool role; `id` is its toolCallId and `ok`/`error` arrive with
// TOOL_CALL_RESULT (unset while the tool is still running). Other roles leave
// them unset.
// `result` is the tool's output text when known (snapshot history).
export type Msg = { role: string; content: string; args?: string; id?: string; ok?: boolean; error?: string; result?: string };

// Folds one AG-UI chat_event into the rendered message list. Text streaming,
// reasoning streaming, and tool calls (name + args) are rendered; everything
// else is a no-op by contract.
export function reduceAgui(messages: Msg[], event: unknown): Msg[] {
  const e = event as {
    type?: unknown; role?: string; delta?: string; toolCallName?: string; toolCallId?: string; content?: string; messageId?: string;
  } | null;
  if (!e || typeof e.type !== "string") return messages;
  switch (e.type) {
    case "TEXT_MESSAGE_START":
      return [...messages, { role: e.role ?? "assistant", content: "", id: e.messageId }];
    case "TEXT_MESSAGE_CONTENT": {
      const last = messages[messages.length - 1];
      // A delta belongs to the message START opened (by id); otherwise it can
      // only continue an assistant message, never a finished user one.
      const continues = !!last && ((!!last.id && last.id === e.messageId) || last.role !== "user");
      if (!continues) return [...messages, { role: "assistant", content: e.delta ?? "" }];
      return [...messages.slice(0, -1), { ...last, content: last.content + (e.delta ?? "") }];
    }
    case "REASONING_MESSAGE_START":
      return [...messages, { role: "reasoning", content: "" }];
    case "REASONING_MESSAGE_CONTENT": {
      const last = messages[messages.length - 1];
      if (last?.role !== "reasoning")
        return [...messages, { role: "reasoning", content: e.delta ?? "" }];
      return [...messages.slice(0, -1), { ...last, content: last.content + (e.delta ?? "") }];
    }
    case "TOOL_CALL_START":
      return [...messages, { role: "tool", content: e.toolCallName ?? "tool", args: "", id: e.toolCallId }];
    case "TOOL_CALL_ARGS": {
      const last = messages[messages.length - 1];
      if (last?.role !== "tool") return messages;
      return [...messages.slice(0, -1), { ...last, args: (last.args ?? "") + (e.delta ?? "") }];
    }
    case "TOOL_CALL_RESULT": {
      // content is the CLI's ToolExecutionResult JSON ({success, error, ...}).
      let r: { success?: unknown; error?: unknown };
      try {
        r = JSON.parse(e.content ?? "");
      } catch {
        return messages;
      }
      let i = messages.findIndex((m) => m.role === "tool" && m.id !== undefined && m.id === e.toolCallId);
      if (i < 0) i = messages.map((m) => m.role).lastIndexOf("tool");
      if (i < 0) return messages;
      const m = { ...messages[i], ok: r.success === true, error: typeof r.error === "string" ? r.error : undefined };
      return [...messages.slice(0, i), m, ...messages.slice(i + 1)];
    }
    default:
      return messages;
  }
}

// Per-turn busy flag from the AG-UI stream: each agent turn is one run, so
// RUN_STARTED arms the loader and the run's terminal event clears it. A
// RUN_ERROR without a runId is a routing error that ends no run. selfRunIds are
// the extension's own tool_request ids, which never carry an agent turn.
export function runningFromEvent(current: boolean, event: unknown, selfRunIds?: Pick<Set<string>, "has">): boolean {
  const e = event as { type?: unknown; runId?: unknown } | null;
  if (typeof e?.runId === "string" && selfRunIds?.has(e.runId)) return current;
  if (e?.type === "RUN_STARTED") return true;
  if (e?.type === "RUN_FINISHED") return false;
  if (e?.type === "RUN_ERROR") return typeof e.runId === "string" ? false : current;
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

// snapshotToMessages rebuilds the panel transcript from a MESSAGES_SNAPSHOT:
// assistant toolCalls become tool rows (name + args + id), and a tool message
// attaches its content as that row's result, with `error` marking it failed.
export function snapshotToMessages(list: Message[]): Msg[] {
  const out: Msg[] = [];
  for (const m of list) {
    const content = typeof m.content === "string" ? m.content : "";
    if (m.role === "tool") {
      const row = out.find((o) => o.role === "tool" && o.id === m.toolCallId);
      if (row) {
        row.result = content;
        row.ok = !m.error;
        row.error = m.error ?? undefined;
        continue;
      }
    }
    if (content) out.push({ role: m.role, content });
    if (m.role !== "assistant") continue;
    for (const tc of m.toolCalls ?? []) {
      out.push({ role: "tool", content: tc.function.name, args: tc.function.arguments, id: tc.id });
    }
  }
  return out;
}

// A question the AskUserQuestion tool asked, read from the tool call's args.
export type Question = { header: string; question: string; options: { label: string; description: string }[]; multiSelect: boolean };
export type Answer = { header: string; question: string; selectedLabels: string[]; otherText: string };

// Parses the AskUserQuestion tool call's args JSON into the questions its
// input_required interrupt waits on. [] when the args are not that shape.
export function parseQuestions(args?: string): Question[] {
  let o: { questions?: unknown };
  try {
    o = JSON.parse(args ?? "");
  } catch {
    return [];
  }
  if (!Array.isArray(o?.questions)) return [];
  return o.questions.flatMap((raw): Question[] => {
    const q = raw as { header?: unknown; question?: unknown; options?: unknown; multiSelect?: unknown } | null;
    if (typeof q?.question !== "string") return [];
    const options = (Array.isArray(q.options) ? q.options : []).flatMap((opt): Question["options"] => {
      const o = opt as { label?: unknown; description?: unknown } | null;
      return typeof o?.label === "string" ? [{ label: o.label, description: typeof o.description === "string" ? o.description : "" }] : [];
    });
    return [{ header: typeof q.header === "string" ? q.header : "", question: q.question, options, multiSelect: q.multiSelect === true }];
  });
}

// What the panel renders for one open interrupt of the run: an approval prompt
// for a tool call (name and args from the tool row the run streamed), or the
// questions of an AskUserQuestion form.
export type PendingInterrupt =
  | { id: string; reason: "tool_call"; toolName: string; toolArgs: string }
  | { id: string; reason: "input_required"; questions: Question[] };

export function pendingInterrupts(interrupts: Interrupt[], messages: Msg[]): PendingInterrupt[] {
  return interrupts.flatMap((it): PendingInterrupt[] => {
    const row = messages.find((m) => m.role === "tool" && m.id === (it.toolCallId ?? it.id));
    if (it.reason === "input_required") return [{ id: it.id, reason: "input_required", questions: parseQuestions(row?.args) }];
    if (it.reason === "tool_call") return [{ id: it.id, reason: "tool_call", toolName: row?.content ?? "", toolArgs: row?.args ?? "" }];
    return [];
  });
}

// prettyArgs pretty-prints a tool's raw JSON args for the expanded pill,
// returning the raw string when it isn't valid JSON (mid-stream partial).
export function prettyArgs(args?: string): string {
  if (!args) return "";
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
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

// Parses a `history` wire frame (the CLI's shared shell input history, oldest
// first) into string entries, dropping non-strings.
export function parseHistory(frame: Record<string, unknown>): string[] {
  const list = frame.history;
  if (!Array.isArray(list)) return [];
  return list.filter((h): h is string => typeof h === "string" && h !== "");
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
// An approval prompt: a tool_call interrupt of the run, or the CUSTOM
// approval_request of a panel-initiated tool_request (which runs outside any
// run and so cannot suspend one).
export type PendingApproval = { id: string; source: "interrupt" | "tool_request"; toolName: string; toolArgs: string };
export type PendingQuestion = { id: string; questions: Question[] };

// A file the user attached in the composer: raw base64 (no data-URL prefix),
// its original filename and mime type. It travels as an image content part of
// the run_agent_input user message.
export type Attachment = { filename: string; mime_type: string; data: string };

// Per-file raw-byte cap (10 MB) and attachment count cap, so one dropped
// screenshot can't blow the single WS text frame run_agent_input travels in.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

// Validates an unknown attachments array (a port message from the panel):
// drops non-objects and entries without usable strings, and enforces the caps.
export function parseAttachments(value: unknown): Attachment[] {
  const list = Array.isArray(value) ? value : [];
  const out: Attachment[] = [];
  for (const raw of list) {
    const o = raw as { filename?: unknown; mime_type?: unknown; data?: unknown } | null;
    if (typeof o?.filename !== "string" || o.filename === "") continue;
    if (typeof o?.mime_type !== "string" || o.mime_type === "") continue;
    if (typeof o?.data !== "string" || o.data === "") continue;
    if (o.data.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4) continue;
    out.push({ filename: o.filename, mime_type: o.mime_type, data: o.data });
    if (out.length >= MAX_ATTACHMENTS) break;
  }
  return out;
}

// The user message of a run_agent_input: a plain string without attachments,
// else content parts in the CLI's shape (text, then one image part per file).
export function userMessageContent(text: string, attachments: Attachment[]): string | Record<string, unknown>[] {
  if (attachments.length === 0) return text;
  const parts: Record<string, unknown>[] = text ? [{ type: "text", text }] : [];
  for (const a of attachments) parts.push({ type: "image", mimeType: a.mime_type, data: a.data, filename: a.filename });
  return parts;
}

// What an approval card shows: a shell command as written, so its lines and a leading
// `# ...` purpose comment read naturally, and any other call's raw JSON arguments.
export function approvalDetail(approval: PendingApproval): string {
  try {
    const { command } = JSON.parse(approval.toolArgs) as { command?: unknown };
    return typeof command === "string" ? command : approval.toolArgs;
  } catch {
    return approval.toolArgs;
  }
}

export type PanelState = {
  type: "state";
  connected: boolean;
  connecting: boolean;
  running: boolean;
  artifactBase: string;
  messages: Msg[];
  conversations: ConversationMeta[];
  skills: PanelSkill[];
  // the CLI's shell input history, oldest first, for arrow-up recall in the composer.
  history: string[];
  // provider/model ids the CLI is configured with (first = CLI default), for model pickers.
  models: string[];
  // the model the CLI will use for the next turn (from the `models` frame).
  currentModel?: string;
  // the CLI's agent mode as its allowlist key: "standard" | "plan" | "auto".
  mode?: string;
  activeConversationId?: string;
  // the daemon answered the hello with another protocol version: show "update infer".
  updateRequired: boolean;
  // the absolute project dir the panel opens threads in (Options -> CLI Bridge).
  projectDir?: string;
  pendingApproval?: PendingApproval;
  pendingQuestion?: PendingQuestion;
};
export type PanelConnect = { type: "connect" };
export type PanelDisconnect = { type: "disconnect" };
export type PanelUserMessage = { type: "user_message"; content: string; attachments?: Attachment[] };
export type PanelInterrupt = { type: "interrupt" };
export type PanelSelectModel = { type: "select_model"; model: string };
export type PanelSetMode = { type: "set_mode"; mode: string };
export type PanelListConversations = { type: "list_conversations" };
export type PanelResumeConversation = { type: "resume_conversation"; id: string };
export type PanelApproval = { type: "approval_response"; id: string; approved: boolean };
export type PanelQuestionResponse = { type: "question_response"; id: string; answers?: Answer[] };
