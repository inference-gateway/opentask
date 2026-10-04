import * as storage from "../shared/storage";
import { backoffMs, isClearCommand, isVisibleMessage, parseAttachments, parseConversations, parseEvent, parseFrame, parseHistory, parseSkills, pendingInterrupts, reduceAgui, runningFromEvent, snapshotToMessages, stripAnsi, userMessageContent, PROTOCOL_VERSION, type Answer, type Attachment, type ConversationMeta, type Msg, type PanelSkill, type PanelState, type PendingApproval, type PendingInterrupt, type PendingQuestion } from "../shared/agui";
import type { Event, Interrupt } from "@ag-ui/core";

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
let history: string[] = [];
let cliModels: string[] = [];
let currentModel: string | undefined;
let mode: string | undefined;
let activeConversationId: string | undefined;
let updateRequired = false;
let projectDir: string | undefined;
// The CUSTOM approval_request of a panel tool_request, outside any run.
let toolRequestApproval: PendingApproval | undefined;
// The open interrupts of the thread's suspended run, and the answers given so
// far: one resume covering every interrupt goes out once all are answered.
let interrupts: PendingInterrupt[] = [];
const resumeEntries = new Map<string, Record<string, unknown>>();
let controlledTabId: number | undefined;
const panels = new Set<chrome.runtime.Port>();

const PING_INTERVAL_MS = 20_000;
const IDLE_DISCONNECT_MS = 5 * 60_000;
let lastActivity = 0;
let pingTimer: ReturnType<typeof setInterval> | undefined;

function touch() {
  lastActivity = Date.now();
}

function stopKeepalive() {
  clearInterval(pingTimer);
  pingTimer = undefined;
}

// Chrome only extends the MV3 service worker's lifetime on WebSocket *message*
// activity - the CLI's protocol-level pings are control frames handled below
// JS and don't count - so send a JSON ping (ignored by the CLI) every 20s to
// keep the worker alive, and disconnect after 5min without real activity so an
// abandoned panel doesn't pin the worker forever.
function startKeepalive() {
  stopKeepalive();
  touch();
  pingTimer = setInterval(() => {
    if (Date.now() - lastActivity >= IDLE_DISCONNECT_MS) disconnect();
    else send({ type: "ping" });
  }, PING_INTERVAL_MS);
}

function disconnect() {
  wantConnected = false;
  connected = false;
  running = false;
  clearPrompts();
  const sock = ws;
  ws = undefined;
  sock?.close();
  stopKeepalive();
  failPendingTools();
  broadcast();
}

function clearPrompts() {
  toolRequestApproval = undefined;
  interrupts = [];
  resumeEntries.clear();
}

// The one approval prompt the panel shows: the first unanswered tool_call
// interrupt, else a panel tool_request's approval.
function pendingApproval(): PendingApproval | undefined {
  for (const it of interrupts) {
    if (it.reason === "tool_call" && !resumeEntries.has(it.id)) return { id: it.id, source: "interrupt", toolName: it.toolName, toolArgs: it.toolArgs };
  }
  return toolRequestApproval;
}

function pendingQuestion(): PendingQuestion | undefined {
  for (const it of interrupts) {
    if (it.reason === "input_required" && !resumeEntries.has(it.id)) return { id: it.id, questions: it.questions };
  }
  return undefined;
}

export function panelState(): PanelState {
  const clean = messages.map((m) => ({
    ...m,
    content: stripAnsi(m.content),
    ...(m.args !== undefined ? { args: stripAnsi(m.args) } : {}),
  }));
  const approval = pendingApproval();
  const cleanApproval = approval && { ...approval, toolName: stripAnsi(approval.toolName), toolArgs: stripAnsi(approval.toolArgs) };
  return { type: "state", connected, connecting: wantConnected && !connected, running, artifactBase: `http://127.0.0.1:${httpPort}`, messages: clean.filter(isVisibleMessage), conversations, skills, history, models: cliModels, currentModel, mode, activeConversationId, updateRequired, projectDir, pendingApproval: cleanApproval, pendingQuestion: pendingQuestion() };
}

function broadcast() {
  const state = panelState();
  for (const p of panels) p.postMessage(state);
}

function send(frame: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

// Sends a frame scoped to the panel's project dir, which the daemon needs to
// pick (or start) the thread's worker. Nothing goes out without one.
function sendInProject(frame: Record<string, unknown>) {
  if (projectDir) send({ ...frame, project_dir: projectDir });
}

function requestLists() {
  for (const type of ["list_conversations", "list_skills", "list_models", "list_history"]) sendInProject({ type });
}

// Starts the thread's next run with the panel's message: the run_agent_input
// carries only the new message, since the worker owns the history.
function sendRunInput(content: string | Record<string, unknown>[]) {
  send({
    type: "run_agent_input",
    input: {
      threadId: activeConversationId ?? "",
      runId: crypto.randomUUID(),
      messages: [{ id: crypto.randomUUID(), role: "user", content }],
    },
  });
}

// Answers every open interrupt of the suspended run in one resume, once the
// user has answered each of them.
function sendResumeWhenComplete() {
  if (interrupts.length === 0 || interrupts.some((it) => !resumeEntries.has(it.id))) return;
  send({ type: "run_agent_input", input: { threadId: activeConversationId ?? "", runId: crypto.randomUUID(), messages: [], resume: [...resumeEntries.values()] } });
  interrupts = [];
  resumeEntries.clear();
  clearApprovalAlert();
}

export const CLI_DOWN = "Connect the infer daemon to use GitHub features (Options -> Orchestrator -> CLI Bridge).";

export type ToolResult = { success: boolean; output: string; error: string };

const pendingTools = new Map<string, { resolve: (r: ToolResult) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

// tool_request ids issued by callTool, so a run carrying one never arms the
// panel loader. Entries clear on the request's tool_result.
const selfToolIds = new Set<string>();

// Invoke a CLI tool over the bridge (tool_request/tool_result frames). The CLI
// runs it through its normal tool pipeline, so an approval prompt may sit in
// front of the result - hence the generous default timeout.
export function callTool(toolName: string, args: object, timeoutMs = 120_000): Promise<ToolResult> {
  if (!connected || !projectDir) return Promise.reject(new Error(CLI_DOWN));
  touch();
  const id = crypto.randomUUID();
  selfToolIds.add(id);
  sendInProject({ type: "tool_request", id, tool_name: toolName, tool_args: JSON.stringify(args) });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingTools.delete(id);
      reject(new Error("infer CLI tool call timed out"));
    }, timeoutMs);
    pendingTools.set(id, { resolve, reject, timer });
  });
}

// Mirrors the CLI's history append for a just-sent message (trimmed, consecutive
// duplicates skipped) so arrow-up recall is fresh without re-fetching the list;
// the CLI persists the same entry to the shared store on its side.
function recordHistory(content: string) {
  const c = content.trim();
  if (!c || history[history.length - 1] === c) return;
  history = [...history, c];
}

// Grab the user's attention on an approval request: try to open the side panel
// outright (Chrome only allows that on a user gesture, so it usually throws
// when triggered by a WebSocket frame), and fall back to an action badge plus
// a clickable system notification that opens the panel.
const APPROVAL_NOTIFICATION = "opentask-approval";
async function alertApproval(req: PendingApproval) {
  const win = await chrome.windows.getLastFocused().catch(() => undefined);
  if (win?.id !== undefined) {
    try {
      await chrome.sidePanel.open({ windowId: win.id });
      return;
    } catch {
      // No user gesture - fall through to badge + notification.
    }
  }
  void chrome.action.setBadgeText({ text: "!" });
  void chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  void chrome.notifications?.create(APPROVAL_NOTIFICATION, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "OpenTask: approval needed",
    message: `The agent wants to run ${stripAnsi(req.toolName)}. Click to review.`,
  });
}

function clearApprovalAlert() {
  void chrome.action.setBadgeText({ text: "" });
  void chrome.notifications?.clear(APPROVAL_NOTIFICATION);
}

// Open a fresh thread in the panel's project. The daemon answers with an empty
// MESSAGES_SNAPSHOT and the first RUN_STARTED names the conversation id.
export function startNewSession(): boolean {
  if (!connected || !projectDir) return false;
  sendInProject({ type: "new_session" });
  messages = [];
  running = false;
  clearPrompts();
  activeConversationId = undefined;
  broadcast();
  return true;
}

// Send a prompt into the connection's thread as the next run: the turn streams
// back as AG-UI events and approvals surface in the panel as interrupts.
export function sendUserMessage(content: string, attachments: Attachment[] = []): boolean {
  if (!connected) return false;
  if (!activeConversationId && !startNewSession()) return false;
  touch();
  sendRunInput(userMessageContent(content, attachments));
  recordHistory(content);
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
  projectDir = (await storage.get<string>("bridge-project-dir"))?.trim() || undefined;
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
      client: "extension",
      protocol_version: PROTOCOL_VERSION,
      extension_version: chrome.runtime.getManifest().version,
    }));
  };

  socket.onmessage = (ev) => void handleFrame(socket, ev.data);

  socket.onclose = () => {
    if (ws !== socket) return;
    ws = undefined;
    connected = false;
    running = false;
    clearPrompts();
    stopKeepalive();
    failPendingTools();
    broadcast();
    scheduleReconnect();
  };
  socket.onerror = () => socket.close();
}

// Chrome dials on the side panel's Connect button. Firefox and Safari have no side
// panel to click, so there a configured token is itself the request to connect.
const noPanelSurface = () => !chrome.sidePanel;

function requestConnect() {
  wantConnected = true;
  attempt = 0;
  void connect();
  broadcast();
}

function scheduleReconnect() {
  if (attempt >= 5) return;
  setTimeout(() => { if (wantConnected && !connected) void connect(); }, backoffMs(attempt++));
}

export async function handleFrame(socket: WebSocket, data: unknown) {
  const frame = parseFrame(data);
  if (!frame) return;
  if (typeof frame.type === "string" && frame.type === frame.type.toUpperCase()) {
    const event = parseEvent(frame);
    if (event) handleEvent(event);
    return;
  }
  switch (frame.type) {
    case "browser_hello_ack":
      connected = true;
      updateRequired = frame.protocol_version !== PROTOCOL_VERSION;
      attempt = 0;
      startKeepalive();
      requestLists();
      if (activeConversationId) sendInProject({ type: "resume_conversation", id: activeConversationId });
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
    case "history":
      history = parseHistory(frame);
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
      touch();
      const result = await runCommand(frame as unknown as BrowserCommand);
      if (ws === socket) send(result);
      return;
    }
    case "tool_result": {
      const pending = typeof frame.id === "string" ? pendingTools.get(frame.id) : undefined;
      if (!pending) return;
      pendingTools.delete(frame.id as string);
      selfToolIds.delete(frame.id as string);
      clearTimeout(pending.timer);
      pending.resolve({
        success: frame.success === true,
        output: typeof frame.output === "string" ? frame.output : "",
        error: typeof frame.error === "string" ? frame.error : "",
      });
      return;
    }
    default:
      return;
  }
}

// Folds one AG-UI event of the thread into the panel state.
function handleEvent(event: Event) {
  touch();
  const next = reduceAgui(messages, event);
  const nextRunning = runningFromEvent(running, event, selfToolIds);
  let changed = next !== messages || nextRunning !== running;
  messages = next;
  running = nextRunning;
  switch (event.type) {
    case "RUN_STARTED":
      changed = true;
      clearPrompts();
      clearApprovalAlert();
      if (event.threadId && event.threadId !== activeConversationId) {
        activeConversationId = event.threadId;
        sendInProject({ type: "list_conversations" });
      }
      break;
    case "RUN_FINISHED":
      changed = true;
      if (event.outcome?.type === "interrupt") suspendOn(event.outcome.interrupts);
      break;
    case "RUN_ERROR":
      changed = true;
      messages = [...messages, { role: "assistant", content: `⚠ ${event.message}` }];
      break;
    case "MESSAGES_SNAPSHOT":
      changed = true;
      messages = snapshotToMessages(event.messages);
      running = false;
      break;
    case "CUSTOM":
      changed = handleCustom(event.name, event.value);
      break;
  }
  if (changed) broadcast();
}

function suspendOn(open: Interrupt[]) {
  interrupts = pendingInterrupts(open, messages);
  resumeEntries.clear();
  const approval = pendingApproval();
  if (approval) void alertApproval(approval);
}

// The CUSTOM events left on the wire: a panel tool_request's approval, which
// runs outside any run, and its resolution by another client.
function handleCustom(name: string, value: unknown): boolean {
  const v = value as { tool_call_id?: unknown; tool_name?: unknown; tool_args?: unknown } | null;
  if (typeof v?.tool_call_id !== "string" || v.tool_call_id === "") return false;
  if (name === "approval_request") {
    toolRequestApproval = {
      id: v.tool_call_id,
      source: "tool_request",
      toolName: typeof v.tool_name === "string" ? v.tool_name : "",
      toolArgs: typeof v.tool_args === "string" ? v.tool_args : "",
    };
    void alertApproval(toolRequestApproval);
    return true;
  }
  if (name === "approval_resolved" && toolRequestApproval?.id === v.tool_call_id) {
    toolRequestApproval = undefined;
    clearApprovalAlert();
    return true;
  }
  return false;
}

// Routes the panel's answer to an approval prompt: a resume entry for a run
// interrupt, or the approval_response frame for a panel tool_request.
function answerApproval(id: string, approved: boolean) {
  if (toolRequestApproval?.id === id) {
    send({ type: "approval_response", tool_call_id: id, approved });
    toolRequestApproval = undefined;
    clearApprovalAlert();
    return;
  }
  if (!interrupts.some((it) => it.id === id)) return;
  resumeEntries.set(id, { interruptId: id, status: approved ? "resolved" : "cancelled" });
  sendResumeWhenComplete();
}

function answerQuestion(id: string, answers?: Answer[]) {
  if (!interrupts.some((it) => it.id === id)) return;
  resumeEntries.set(id, answers ? { interruptId: id, status: "resolved", payload: { answers } } : { interruptId: id, status: "cancelled" });
  sendResumeWhenComplete();
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

export async function runCommand(cmd: BrowserCommand) {
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
      try {
        const find = (q: string): HTMLElement | null => {
          if (!q.startsWith("text=")) return document.querySelector(q) as HTMLElement | null;
          const text = q.slice(5).replace(/^["']|["']$/g, "");
          const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const el = n.parentElement;
            if (n.textContent?.includes(text) && el && el.checkVisibility?.() !== false) return el;
          }
          return null;
        };
        const el = find(s);
        if (!el) throw new Error("selector not found: " + s);
        el.click();
        return {};
      } catch (e) {
        return { err: e instanceof Error ? e.message : String(e) };
      }
    }, [sel]);
    return {};
  }
  if (cmd.action === "type") {
    await run(tabId, (s: string, text: string, enter: boolean) => {
      try {
        const find = (q: string): HTMLElement | null => {
          if (!q.startsWith("text=")) return document.querySelector(q) as HTMLElement | null;
          const text = q.slice(5).replace(/^["']|["']$/g, "");
          const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const el = n.parentElement;
            if (n.textContent?.includes(text) && el && el.checkVisibility?.() !== false) return el;
          }
          return null;
        };
        const el = find(s) as (HTMLElement & { value?: string }) | null;
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
        return {};
      } catch (e) {
        return { err: e instanceof Error ? e.message : String(e) };
      }
    }, [sel, cmd.text ?? "", cmd.press_enter === true]);
    return {};
  }
  if (cmd.action === "read") {
    const content = await run(tabId, (s: string) => {
      try {
        const el = (s ? document.querySelector(s) : document.body) as HTMLElement | null;
        if (!el) throw new Error("selector not found: " + s);
        const tag = el.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") {
          const type = (el.getAttribute("type") || "").toLowerCase();
          const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
          const hay = ((el.getAttribute("name") || "") + " " + (el.id || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
          const sensitive = type === "password" || ac === "current-password" || ac === "new-password" || ac === "one-time-code" || /pass|secret|token|otp|cvc|card/.test(hay);
          return { value: sensitive ? "[redacted]" : ((el as HTMLInputElement).value || "") };
        }
        return { value: el.innerText };
      } catch (e) {
        return { err: e instanceof Error ? e.message : String(e) };
      }
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

// Result envelope for injected page functions: when the injected function
// throws, chrome.scripting.executeScript still resolves (with result:
// undefined) and the exception dies in the page console, so injected
// functions catch everything and return the error as data for run() to
// re-throw into browser_result.error. Do NOT let injected functions throw.
type Injected<R> = { value?: R; err?: string };

async function run<A extends unknown[], R>(tabId: number, func: (...args: A) => Injected<R>, args: A): Promise<R> {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func, args } as never);
  const r = result as Injected<R> | undefined;
  if (r?.err) throw new Error(r.err);
  return r?.value as R;
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

// Test seams: a fake socket to capture outbound frames, and a reset of the
// module state between tests.
export function __setSocket(sock: WebSocket | undefined) {
  ws = sock;
}

export function __reset(opts: { projectDir?: string } = {}) {
  connected = false;
  wantConnected = false;
  running = false;
  messages = [];
  activeConversationId = undefined;
  updateRequired = false;
  projectDir = opts.projectDir;
  clearPrompts();
  selfToolIds.clear();
}

export function initBridge() {
  chrome.notifications?.onClicked.addListener((id) => {
    if (id !== APPROVAL_NOTIFICATION) return;
    clearApprovalAlert();
    void chrome.windows.getLastFocused().then((win) => {
      if (win?.id !== undefined) return chrome.sidePanel.open({ windowId: win.id });
    }).catch(() => undefined);
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "bridge-panel") return;
    panels.add(port);
    clearApprovalAlert();
    port.onDisconnect.addListener(() => panels.delete(port));
    port.onMessage.addListener((msg) => {
      touch();
      if (msg?.type === "connect") {
        requestConnect();
      }
      if (msg?.type === "disconnect") {
        disconnect();
      }
      if (msg?.type === "list_conversations") {
        sendInProject({ type: "list_conversations" });
      }
      if (msg?.type === "resume_conversation" && typeof msg.id === "string") {
        activeConversationId = msg.id;
        clearPrompts();
        sendInProject({ type: "resume_conversation", id: msg.id });
        broadcast();
      }
      if (msg?.type === "user_message" && typeof msg.content === "string" && msg.content.trim()) {
        const content = msg.content.trim();
        if (isClearCommand(content)) startNewSession();
        else sendUserMessage(content, parseAttachments(msg.attachments));
      }
      if (msg?.type === "select_model" && typeof msg.model === "string" && msg.model) {
        sendInProject({ type: "select_model", model: msg.model });
        currentModel = msg.model;
        broadcast();
      }
      if (msg?.type === "set_mode" && typeof msg.mode === "string" && msg.mode) {
        sendInProject({ type: "set_mode", mode: msg.mode });
        mode = msg.mode;
        broadcast();
      }
      if (msg?.type === "interrupt") {
        send({ type: "interrupt" });
      }
      if (msg?.type === "approval_response" && typeof msg.id === "string") {
        answerApproval(msg.id, msg.approved === true);
        broadcast();
      }
      if (msg?.type === "question_response" && typeof msg.id === "string") {
        answerQuestion(msg.id, Array.isArray(msg.answers) ? (msg.answers as Answer[]) : undefined);
        broadcast();
      }
    });
    port.postMessage(panelState());
  });

  chrome.alarms.create("bridge-redial", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name !== "bridge-redial" || connected) return;
    if (wantConnected || noPanelSurface()) requestConnect();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!("bridge-port" in changes || "bridge-token" in changes || "bridge-project-dir" in changes)) return;
    if (!wantConnected && !noPanelSurface()) return;
    connected = false;
    requestConnect();
  });

  if (noPanelSurface()) requestConnect();
}
