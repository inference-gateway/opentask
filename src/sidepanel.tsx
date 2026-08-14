import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as storage from "./shared/storage";
import { applyTheme, type Theme } from "./shared/theme";
import type { Msg, PanelApproval, PanelState, PanelUserMessage, PendingApproval } from "./shared/agui";
import { Button } from "@/ui/components/button";
import { Textarea } from "@/ui/components/textarea";
import { toolLabel } from "./shared/agui";
import { Markdown } from "./lib/markdown";

function SidePanel() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const portRef = useRef<chrome.runtime.Port | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const t = (await storage.get<string>("theme")) as Theme | undefined;
      applyTheme(t === "light" || t === "dark" ? t : "system");
    })();
  }, []);

  useEffect(() => {
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    function dial() {
      const port = chrome.runtime.connect({ name: "bridge-panel" });
      portRef.current = port;
      port.onMessage.addListener((msg: PanelState) => {
        if (msg?.type !== "state") return;
        setConnected(msg.connected);
        setMessages(msg.messages);
        setPendingApproval(msg.pendingApproval);
      });
      port.onDisconnect.addListener(() => {
        if (!closed) timer = setTimeout(dial, 1000);
      });
    }
    dial();
    return () => {
      closed = true;
      clearTimeout(timer);
      portRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function sendMessage() {
    const content = draft.trim();
    if (!content) return;
    portRef.current?.postMessage({ type: "user_message", content } satisfies PanelUserMessage);
    setDraft("");
  }

  function respondApproval(action: "approve" | "reject") {
    if (!pendingApproval) return;
    portRef.current?.postMessage({
      type: "approval_response",
      requestId: pendingApproval.requestId,
      action,
    } satisfies PanelApproval);
    setPendingApproval(undefined);
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-background to-muted/40 text-foreground text-sm">
      <header className="flex items-center gap-2 border-b border-border/60 bg-background/80 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-sm">
          ⌘
        </div>
        <span className="font-semibold tracking-tight">OpenTask</span>
        <span
          className={
            "ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium " +
            (connected
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
          }
        >
          <span
            className={
              "size-1.5 rounded-full " +
              (connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500")
            }
          />
          {connected ? "Connected" : "Offline"}
        </span>
      </header>

      {!connected && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Not connected to the infer CLI. Set the bridge port and token in Settings and make sure
          the CLI is running.
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-600/15 text-2xl">
              💬
            </div>
            <p className="text-sm font-medium text-foreground">No conversation yet</p>
            <p className="max-w-[220px] text-xs">Send a message below to start talking to the agent.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-3.5 py-2 text-white shadow-sm whitespace-pre-wrap"
                  : m.role === "tool"
                    ? "flex max-w-[85%] items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 font-mono text-xs text-muted-foreground"
                    : "max-w-[85%] rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2 text-card-foreground shadow-sm"
              }
            >
              {m.role === "tool" ? (
                <>
                  <span className="text-indigo-500">⚙</span>
                  <span className="truncate">{toolLabel(m.content, m.args)}</span>
                </>
              ) : m.role === "assistant" ? (
                <Markdown text={m.content} />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {pendingApproval && (
        <div className="border-t border-amber-500/30 bg-amber-500/5 p-3">
          <div className="rounded-xl border border-amber-500/40 bg-card p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-md bg-amber-500/15 text-xs">⚠</span>
              <span className="text-sm font-semibold">
                Approve <span className="font-mono text-amber-600 dark:text-amber-400">{pendingApproval.toolName}</span>?
              </span>
            </div>
            {pendingApproval.toolArgs && (
              <pre className="mb-3 max-h-40 overflow-auto rounded-lg bg-muted/70 p-2 font-mono text-[0.8em] leading-relaxed">
                {pendingApproval.toolArgs}
              </pre>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => respondApproval("approve")}>
                Approve
              </Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => respondApproval("reject")}>
                Deny
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border/60 bg-background/80 p-3 backdrop-blur-sm">
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card p-1.5 shadow-sm transition-colors focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Textarea
            rows={2}
            placeholder="Message the agent…"
            value={draft}
            className="min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            size="icon-sm"
            disabled={!connected || !draft.trim()}
            onClick={sendMessage}
            className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:opacity-90"
            aria-label="Send message"
          >
            ↑
          </Button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
