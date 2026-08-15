// WebSocket client for the infer CLI browser bridge (issue #141). The CLI hosts
// ws://127.0.0.1:<port>/ws; we dial in, authenticate with a shared token, execute
// browser_command frames on a single controlled tab, and mirror the conversation
// to the side panel. Contract: inference-gateway/cli docs/browser-extension-protocol.md.
import * as storage from "../shared/storage";
import { approvalFromFrame, backoffMs, isClearCommand, isVisibleMessage, parseFrame, reduceAgui, type Msg, type PanelState, type PendingApproval } from "../shared/agui";

export const DEFAULT_PORT = "52789";

let ws: WebSocket | undefined;
let connected = false;
let wantConnected = false;
let attempt = 0;
let messages: Msg[] = [];
let pendingApproval: PendingApproval | undefined;
let controlledTabId: number | undefined;
const panels = new Set<chrome.runtime.Port>();

function panelState(): PanelState {
  return { type: "state", connected, connecting: wantConnected && !connected, messages: messages.filter(isVisibleMessage), pendingApproval };
}

function broadcast() {
  const state = panelState();
  for (const p of panels) p.postMessage(state);
}

function send(frame: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

async function connect() {
  const token = (await storage.get<string>("bridge-token"))?.trim();
  if (!token) {
    wantConnected = false;
    broadcast();
    return;
  }
  const port = (await storage.get<string>("bridge-port"))?.trim() || DEFAULT_PORT;
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
    pendingApproval = undefined;
    broadcast();
    scheduleReconnect();
  };
  socket.onerror = () => socket.close();
}

function scheduleReconnect() {
  setTimeout(() => { if (wantConnected && !connected) void connect(); }, backoffMs(attempt++));
}

async function handleFrame(socket: WebSocket, data: unknown) {
  const frame = parseFrame(data);
  if (!frame) return;
  switch (frame.type) {
    case "browser_hello_ack":
      connected = true;
      attempt = 0;
      broadcast();
      return;
    case "browser_command": {
      const result = await runCommand(frame as unknown as BrowserCommand);
      if (ws === socket) send(result);
      return;
    }
    case "conversation_snapshot": {
      const list = Array.isArray(frame.messages) ? (frame.messages as Msg[]) : [];
      messages = list
        .filter((m) => m && typeof m.role === "string")
        .map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" }));
      broadcast();
      return;
    }
    case "chat_event": {
      const next = reduceAgui(messages, frame.event);
      if (next !== messages) {
        messages = next;
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
  action: "navigate" | "click" | "type" | "read" | string;
  url?: string;
  selector?: string;
  text?: string;
  press_enter?: boolean;
  timeout_ms?: number;
};

async function runCommand(cmd: BrowserCommand) {
  const result = { type: "browser_result", id: cmd.id, url: "", title: "", content: "", events: [], error: "" };
  const DEFAULT_TIMEOUT_MS = 30_000;
  const timeoutMs = DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    result.content = (await Promise.race([exec(cmd), timeout])) ?? "";
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

// Runs one action and returns the content for "read" (undefined otherwise).
async function exec(cmd: BrowserCommand): Promise<string | undefined> {
  if (cmd.action === "navigate") {
    if (!cmd.url) throw new Error("navigate requires url");
    const existing = controlledTabId === undefined ? undefined : await chrome.tabs.get(controlledTabId).catch(() => undefined);
    const tab = existing
      ? await chrome.tabs.update(existing.id!, { url: cmd.url, active: true })
      : await chrome.tabs.create({ url: cmd.url });
    if (tab?.id === undefined) throw new Error("failed to open controlled tab");
    controlledTabId = tab.id;
    await waitForLoad(tab.id);
    return undefined;
  }

  const tabId = controlledTabId;
  if (tabId === undefined || !(await chrome.tabs.get(tabId).catch(() => undefined)))
    throw new Error("no controlled tab; navigate first");

  const sel = cmd.selector ?? "";
  if (cmd.action === "click") {
    await run(tabId, (s: string) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el) throw new Error("selector not found: " + s);
      el.click();
    }, [sel]);
    return undefined;
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
    return undefined;
  }
  if (cmd.action === "read") {
    return run(tabId, (s: string) => {
      const el = (s ? document.querySelector(s) : document.body) as HTMLElement | null;
      if (!el) throw new Error("selector not found: " + s);
      return el.innerText;
    }, [sel]);
  }
  throw new Error(`unknown action: ${cmd.action}`);
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
        pendingApproval = undefined;
        const sock = ws;
        ws = undefined;
        sock?.close();
        broadcast();
      }
      if (msg?.type === "user_message" && typeof msg.content === "string" && msg.content.trim()) {
        const content = msg.content.trim();
        send({ type: "user_message", content });
        if (isClearCommand(content)) {
          messages = [];
          pendingApproval = undefined;
        } else {
          messages = [...messages, { role: "user", content }];
        }
        broadcast();
      }
      if (msg?.type === "approval_response" && typeof msg.requestId === "string") {
        send({ type: "approval_response", request_id: msg.requestId, action: msg.action });
        if (pendingApproval?.requestId === msg.requestId) pendingApproval = undefined; // optimistic
        broadcast();
      }
    });
    port.postMessage(panelState());
  });

  chrome.alarms.create("bridge-redial", { periodInMinutes: 0.5 });
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
