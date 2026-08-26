import * as storage from "../shared/storage";
import { approvalFromFrame, backoffMs, isClearCommand, isVisibleMessage, parseConversations, parseFrame, parseSkills, reduceAgui, runningFromEvent, stripAnsi, type ConversationMeta, type Msg, type PanelSkill, type PanelState, type PendingApproval, snapshotToMessages } from "../shared/agui";

export const DEFAULT_PORT = "52789";

let ws: WebSocket | undefined;
let connected = false;
let wantConnected = false;
let running = false;
let httpPort = DEFAULT_PORT;
let attempt = 0;
let messages: Msg[] = [];
let conversations: ConversationMeta[] = [];
let skills: PanelSkill[] = [];
let cliModels: string[] = [];
let currentModel: string | undefined;
let mode: string | undefined;
let activeConversationId: string | undefined;
let pendingApproval: PendingApproval | undefined;
let controlledTabId: number | undefined;
const panels = new Set<chrome.runtime.Port>();

function panelState(): PanelState {
  const clean = messages.map((m) => ({
    ...m,
    content: stripAnsi(m.content),
    ...(m.args !== undefined ? { args: stripAnsi(m.args) } : {}),
  }));
  const approval = pendingApproval && {
    ...pendingApproval,
    toolName: stripAnsi(pendingApproval.toolName),
    toolArgs: stripAnsi(pendingApproval.toolArgs),
  };
  return { type: "state", connected, connecting: wantConnected && !connected, running, artifactBase: `http://127.0.0.1:${httpPort}`, messages: clean.filter(isVisibleMessage), conversations, skills, models: cliModels, currentModel, mode, activeConversationId, pendingApproval: approval };
}

function broadcast() {
  const state = panelState();
  for (const p of panels) p.postMessage(state);
}

function send(frame: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

export const CLI_DOWN = "Connect the infer CLI to use GitHub features (Options -> Orchestrator -> CLI Bridge).";

export type ToolResult = { success: boolean; output: string; error: string };

const pendingTools = new Map<string, { resolve: (r: ToolResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

// Tool-call ids issued by callTool, so their echoed AG-UI events don't arm the
// panel loader. Entries clear on the call's TOOL_CALL_RESULT chat event.
const selfToolIds = new Set<string>();

// Invoke a CLI tool over the bridge (tool_request/tool_result frames). The CLI
// runs it through its normal tool pipeline, so an approval prompt may sit in
// front of the result - hence the generous default timeout.
export function callTool(toolName: string, args: object, timeoutMs = 120_000): Promise<ToolResult> {
  if (!connected) return Promise.reject(new Error(CLI_DOWN));
  const id = crypto.randomUUID();
  selfToolIds.add(id);
  send({ type: "tool_request", id, tool_name: toolName, tool_args: JSON.stringify(args) });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingTools.delete(id);
      reject(new Error("infer CLI tool call timed out"));
    }, timeoutMs);
    pendingTools.set(id, { resolve, reject, timer });
  });
}

// Send a prompt into the connected CLI's chat as a regular user message: the
// turn streams back over chat_event frames and tool approvals surface in the
// panel, exactly as if the user had typed it there.
export function sendUserMessage(content: string): boolean {
  if (!connected) return false;
  send({ type: "user_message", content });
  running = true;
  broadcast();
  return true;
}

function failPendingTools() {
  for (const p of pendingTools.values()) {
    clearTimeout(p.timer);
    p.reject(new Error(CLI_DOWN));
  }
  pendingTools.clear();
}

async function connect() {
  const token = (await storage.get<string>("bridge-token"))?.trim();
  if (!token) {
    wantConnected = false;
    broadcast();
    return;
  }
  const port = (await storage.get<string>("bridge-port"))?.trim() || DEFAULT_PORT;
  httpPort = port;
  if (!wantConnected) return;

  ws?.close();
  let socket: WebSocket;
  try {
    socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  } catch {
    scheduleReconnect();
    return;
  }
  ws = socket;

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: "browser_hello",
      token,
      extension_version: chrome.runtime.getManifest().version,
    }));
  };

  socket.onmessage = (ev) => void handleFrame(socket, ev.data);

  socket.onclose = () => {
    if (ws !== socket) return;
    ws = undefined;
    connected = false;
    running = false;
    pendingApproval = undefined;
    failPendingTools();
    broadcast();
    scheduleReconnect();
  };
  socket.onerror = () => socket.close();
}

function scheduleReconnect() {
  if (attempt >= 5) return;
  setTimeout(() => { if (wantConnected && !connected) void connect(); }, backoffMs(attempt++));
}

async function handleFrame(socket: WebSocket, data: unknown) {
  const frame = parseFrame(data);
  if (!frame) return;
  switch (frame.type) {
    case "browser_hello_ack":
      connected = true;
      attempt = 0;
      send({ type: "list_conversations" });
      send({ type: "list_skills" });
      send({ type: "list_models" });
      if (activeConversationId) send({ type: "resume_conversation", id: activeConversationId });
      broadcast();
      return;
    case "conversations":
      conversations = parseConversations(frame);
      broadcast();
      return;
    case "skills":
      skills = parseSkills(frame);
      broadcast();
      return;
    case "models":
      cliModels = Array.isArray(frame.models) ? (frame.models as unknown[]).filter((m): m is string => typeof m === "string") : [];
      currentModel = typeof frame.current === "string" && frame.current ? frame.current : undefined;
      broadcast();
      return;
    case "mode":
      mode = typeof frame.mode === "string" && frame.mode ? frame.mode : undefined;
      broadcast();
      return;
    case "browser_command": {
      const result = await runCommand(frame as unknown as BrowserCommand);
      if (ws === socket) send(result);
      return;
    }
    case "conversation_snapshot": {
      messages = snapshotToMessages(frame);
      running = false;
      broadcast();
      return;
    }
    case "chat_event": {
      const next = reduceAgui(messages, frame.event);
      const nextRunning = runningFromEvent(running, frame.event, selfToolIds);
      const ev = frame.event as { type?: unknown; toolCallId?: unknown } | null;
      if (ev?.type === "TOOL_CALL_RESULT" && typeof ev.toolCallId === "string") selfToolIds.delete(ev.toolCallId);
      if (next !== messages || nextRunning !== running) {
        messages = next;
        running = nextRunning;
        broadcast();
      }
      return;
    }
    case "approval_request": {
      const req = approvalFromFrame(frame);
      if (!req) return;
      pendingApproval = req;
      broadcast();
      return;
    }
    case "tool_result": {
      const pending = typeof frame.id === "string" ? pendingTools.get(frame.id) : undefined;
      if (!pending) return;
      pendingTools.delete(frame.id as string);
      clearTimeout(pending.timer);
      pending.resolve({
        success: frame.success === true,
        output: typeof frame.output === "string" ? frame.output : "",
        error: typeof frame.error === "string" ? frame.error : "",
      });
      return;
    }
    case "approval_resolved": {
      if (pendingApproval && pendingApproval.requestId === frame.request_id) {
        pendingApproval = undefined;
        broadcast();
      }
      return;
    }
    default:
      return;
  }
}

type BrowserCommand = {
  type: "browser_command";
  id: string;
  action: "navigate" | "click" | "type" | "read" | "screenshot" | "tabs" | string;
  url?: string;
  selector?: string;
  text?: string;
  press_enter?: boolean;
  timeout_ms?: number;
};

async function runCommand(cmd: BrowserCommand) {
  const result: Record<string, unknown> = { type: "browser_result", id: cmd.id, url: "", title: "", content: "", events: [], error: "" };
  const DEFAULT_TIMEOUT_MS = 30_000;
  const timeoutMs = DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    Object.assign(result, (await Promise.race([exec(cmd), timeout])) ?? {});
    const tab = controlledTabId === undefined ? undefined : await chrome.tabs.get(controlledTabId).catch(() => undefined);
    result.url = tab?.url ?? "";
    result.title = tab?.title ?? "";
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }
  return result;
}

// Runs one action and returns the result fields to merge (content for "read",
// image for "screenshot", tabs for "tabs", empty otherwise).
async function exec(cmd: BrowserCommand): Promise<Record<string, unknown>> {
  if (cmd.action === "navigate") {
    if (!cmd.url) throw new Error("navigate requires url");
    const existing = controlledTabId === undefined ? undefined : await chrome.tabs.get(controlledTabId).catch(() => undefined);
    const tab = existing
      ? await chrome.tabs.update(existing.id!, { url: cmd.url, active: true })
      : await chrome.tabs.create({ url: cmd.url });
    if (tab?.id === undefined) throw new Error("failed to open controlled tab");
    controlledTabId = tab.id;
    await waitForLoad(tab.id);
    return {};
  }

  if (cmd.action === "tabs") {
    const focusedId = await activeTabId();
    const tabs = await chrome.tabs.query({});
    return {
      tabs: tabs.map((t, i) => ({ index: i, url: t.url ?? "", title: t.title ?? "", active: t.id === focusedId })),
    };
  }

  let tabId = controlledTabId;
  if (tabId === undefined || !(await chrome.tabs.get(tabId).catch(() => undefined)))
    tabId = await activeTabId();
  if (tabId === undefined) throw new Error("no active tab");

  const sel = cmd.selector ?? "";
  if (cmd.action === "click") {
    await run(tabId, (s: string) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el) throw new Error("selector not found: " + s);
      el.click();
    }, [sel]);
    return {};
  }
  if (cmd.action === "type") {
    await run(tabId, (s: string, text: string, enter: boolean) => {
      const el = document.querySelector(s) as (HTMLElement & { value?: string }) | null;
      if (!el) throw new Error("selector not found: " + s);
      el.focus();
      if ("value" in el) el.value = text;
      else el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (enter) {
        for (const t of ["keydown", "keypress", "keyup"])
          el.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", bubbles: true }));
        (el.closest("form") as HTMLFormElement | null)?.requestSubmit?.();
      }
    }, [sel, cmd.text ?? "", cmd.press_enter === true]);
    return {};
  }
  if (cmd.action === "read") {
    const content = await run(tabId, (s: string) => {
      const el = (s ? document.querySelector(s) : document.body) as HTMLElement | null;
      if (!el) throw new Error("selector not found: " + s);
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        const type = (el.getAttribute("type") || "").toLowerCase();
        const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
        const hay = ((el.getAttribute("name") || "") + " " + (el.id || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
        const sensitive = type === "password" || ac === "current-password" || ac === "new-password" || ac === "one-time-code" || /pass|secret|token|otp|cvc|card/.test(hay);
        return sensitive ? "[redacted]" : ((el as HTMLInputElement).value || "");
      }
      return el.innerText;
    }, [sel]);
    return { content };
  }
  if (cmd.action === "screenshot") {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const comma = dataUrl.indexOf(",");
    return { image: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, image_mime_type: "image/png" };
  }
  throw new Error(`unknown action: ${cmd.action}`);
}

async function activeTabId(): Promise<number | undefined> {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t?.id;
}

async function run<A extends unknown[], R>(tabId: number, func: (...args: A) => R, args: A): Promise<R> {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func, args } as never);
  return result as R;
}

function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

export function initBridge() {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "bridge-panel") return;
    panels.add(port);
    port.onDisconnect.addListener(() => panels.delete(port));
    port.onMessage.addListener((msg) => {
      if (msg?.type === "connect") {
        wantConnected = true;
        attempt = 0;
        void connect();
        broadcast();
      }
      if (msg?.type === "disconnect") {
        wantConnected = false;
        connected = false;
        running = false;
        pendingApproval = undefined;
        const sock = ws;
        ws = undefined;
        sock?.close();
        failPendingTools();
        broadcast();
      }
      if (msg?.type === "list_conversations") {
        send({ type: "list_conversations" });
      }
      if (msg?.type === "resume_conversation" && typeof msg.id === "string") {
        activeConversationId = msg.id;
        send({ type: "resume_conversation", id: msg.id });
        broadcast();
      }
      if (msg?.type === "user_message" && typeof msg.content === "string" && msg.content.trim()) {
        const content = msg.content.trim();
        send({ type: "user_message", content });
        if (isClearCommand(content)) {
          messages = [];
          running = false;
          pendingApproval = undefined;
          activeConversationId = undefined;
        } else {
          running = true;
        }
        broadcast();
      }
      if (msg?.type === "select_model" && typeof msg.model === "string" && msg.model) {
        send({ type: "select_model", model: msg.model });
        currentModel = msg.model;
        broadcast();
      }
      if (msg?.type === "set_mode" && typeof msg.mode === "string" && msg.mode) {
        send({ type: "set_mode", mode: msg.mode });
        mode = msg.mode;
        broadcast();
      }
      if (msg?.type === "interrupt") {
        send({ type: "interrupt" });
        running = false;
        broadcast();
      }
      if (msg?.type === "approval_response" && typeof msg.requestId === "string") {
        send({ type: "approval_response", request_id: msg.requestId, action: msg.action });
        if (pendingApproval?.requestId === msg.requestId) pendingApproval = undefined;
        broadcast();
      }
    });
    port.postMessage(panelState());
  });

  chrome.alarms.create("bridge-redial", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === "bridge-redial" && wantConnected && !connected) void connect();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && ("bridge-port" in changes || "bridge-token" in changes) && wantConnected) {
      connected = false;
      attempt = 0;
      void connect();
    }
  });
}
