import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as storage from "./shared/storage";
import { applyTheme, type Theme } from "./shared/theme";
import type { Msg, PanelState, PanelUserMessage } from "./shared/agui";
import { Button } from "@/ui/components/button";
import { Textarea } from "@/ui/components/textarea";

function SidePanel() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
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
      });
      port.onDisconnect.addListener(() => {
        // reconnecting revives a suspended service worker
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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground text-sm">
      {!connected && (
        <div className="border-b bg-muted px-3 py-2 text-xs text-muted-foreground">
          Not connected to the infer CLI. Set the bridge port and token in Settings and make sure
          the CLI is running.
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-muted-foreground">No conversation yet.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground whitespace-pre-wrap"
                  : m.role === "tool"
                    ? "max-w-[85%] rounded-lg border px-3 py-1 text-xs text-muted-foreground"
                    : "max-w-[85%] rounded-lg bg-muted px-3 py-2 whitespace-pre-wrap"
              }
            >
              {m.role === "tool" ? <>⚙ {m.content}</> : m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t p-3 flex flex-col gap-2">
        <Textarea
          rows={2}
          placeholder="Message the agent…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <Button size="sm" disabled={!connected || !draft.trim()} onClick={sendMessage}>
          Send
        </Button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
