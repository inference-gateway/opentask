import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as storage from "./shared/storage";
import { applyTheme, type Theme } from "./shared/theme";
import type {
  ConversationMeta,
  Msg,
  PanelApproval,
  PanelConnect,
  PanelDisconnect,
  PanelListConversations,
  PanelResumeConversation,
  PanelSkill,
  PanelState,
  PanelInterrupt,
  PanelSelectModel,
  PanelSetMode,
  PanelUserMessage,
  PendingApproval,
} from "./shared/agui";
import { ArrowDown, Check, Copy, SquarePen, X } from "lucide-react";
import { Button } from "@/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/select";
import { Textarea } from "@/ui/components/textarea";
import { prettyArgs, toolLabel } from "./shared/agui";
import { Markdown } from "./lib/markdown";
import { fuzzyFilter, type FuzzyResult } from "./lib/fuzzy";
import { caretPosition, type CaretPos } from "./lib/caret";
import { getTrigger } from "./lib/dom";
import { replaceRange } from "./lib/insert";
import { SkillMenu } from "@/ui/SkillMenu";

// Hover-reveal copy-to-clipboard under a chat bubble, desktop-app style.
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Copy message"
      className="mt-0.5 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="text-emerald-500" /> : <Copy />}
    </Button>
  );
}

function SidePanel() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [running, setRunning] = useState(false);
  const [artifactBase, setArtifactBase] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const histStash = useRef("");
  const [skills, setSkills] = useState<PanelSkill[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<string | undefined>(undefined);
  const [atBottom, setAtBottom] = useState(true);
  const [menu, setMenu] = useState<{ results: FuzzyResult<PanelSkill>[]; active: number; triggerIndex: number; pos: CaretPos } | null>(null);
  const portRef = useRef<chrome.runtime.Port | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
        setConnecting(msg.connecting);
        setRunning(msg.running);
        setArtifactBase(msg.artifactBase);
        setMessages(msg.messages);
        setConversations(msg.conversations);
        setSkills(msg.skills);
        setHistory(msg.history);
        setModels(msg.models);
        setCurrentModel(msg.currentModel);
        setMode(msg.mode);
        setActiveConversationId(msg.activeConversationId);
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

  // Stick to the bottom only while the user is already there; scrolling up
  // during a streaming turn must not be fought - a floating arrow offers the
  // way back down instead.
  useEffect(() => {
    if (atBottom) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, atBottom]);

  function connect() {
    portRef.current?.postMessage({ type: "connect" } satisfies PanelConnect);
  }

  function disconnect() {
    portRef.current?.postMessage({ type: "disconnect" } satisfies PanelDisconnect);
  }

  function newSession() {
    portRef.current?.postMessage({ type: "user_message", content: "/clear" } satisfies PanelUserMessage);
    setDraft("");
  }

  function refreshConversations() {
    portRef.current?.postMessage({ type: "list_conversations" } satisfies PanelListConversations);
  }

  function resumeConversation(id: string) {
    portRef.current?.postMessage({ type: "resume_conversation", id } satisfies PanelResumeConversation);
  }

  function sendMessage() {
    const content = draft.trim();
    if (!content) return;
    portRef.current?.postMessage({ type: "user_message", content } satisfies PanelUserMessage);
    setDraft("");
    setHistIdx(-1);
  }

  function updateSkillMenu() {
    const el = taRef.current;
    const trig = el ? getTrigger(el, "/") : null;
    if (!el || !trig) {
      setMenu(null);
      return;
    }
    setMenu({
      results: fuzzyFilter(skills, trig.query, (s) => s.name),
      active: 0,
      triggerIndex: trig.index,
      pos: caretPosition(el, trig.index),
    });
  }

  function commitSkill(i: number) {
    const el = taRef.current;
    const chosen = menu?.results[i];
    if (el && menu && chosen) {
      replaceRange(el, menu.triggerIndex, el.selectionStart ?? menu.triggerIndex, `/${chosen.item.name} `);
    }
    setMenu(null);
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
              (connected ? "bg-emerald-500 animate-pulse" : connecting ? "bg-amber-500 animate-pulse" : "bg-amber-500")
            }
          />
          {connected ? "Connected" : connecting ? "Connecting…" : "Offline"}
        </span>
        {connected && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={disconnect}>
            Disconnect
          </Button>
        )}
        {connecting && (
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-amber-600 dark:text-amber-400"
            onClick={disconnect}
            aria-label="Stop connecting"
          >
            <X />
          </Button>
        )}
      </header>

      {connected && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-background/60 px-3 py-2">
          <Select
            value={activeConversationId ?? ""}
            onValueChange={resumeConversation}
            onOpenChange={(open) => open && refreshConversations()}
          >
            <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs">
              <SelectValue placeholder="Conversations" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-[50vh] w-(--radix-select-trigger-width)">
              {conversations.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No conversations yet
                </SelectItem>
              ) : (
                conversations.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="[&>span:last-child]:w-full">
                    <span className="min-w-0 flex-1 truncate text-left">{c.title || "Untitled"}</span>
                    <span className="shrink-0 tabular-nums whitespace-nowrap text-xs text-muted-foreground">
                      {c.messageCount} msgs
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button size="icon-xs" variant="ghost" onClick={newSession} aria-label="New chat">
            <SquarePen />
          </Button>
        </div>
      )}

      {connected && models.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-background/60 px-3 py-2">
          <Select
            value={currentModel ?? ""}
            onValueChange={(model) => portRef.current?.postMessage({ type: "select_model", model } satisfies PanelSelectModel)}
          >
            <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 font-mono text-xs" aria-label="Model">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-[50vh] w-(--radix-select-trigger-width)">
              {models.map((m) => (
                <SelectItem key={m} value={m} className="font-mono text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={mode === "auto" ? "default" : "outline"}
            className="h-7 shrink-0 px-2 text-xs"
            aria-pressed={mode === "auto"}
            title="Auto mode: run tools without approval prompts (the CLI's shift+tab YOLO mode)"
            onClick={() =>
              portRef.current?.postMessage({ type: "set_mode", mode: mode === "auto" ? "standard" : "auto" } satisfies PanelSetMode)
            }
          >
            Auto
          </Button>
        </div>
      )}

      {!connected && (
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span className="flex-1">
            Not connected to the infer CLI. Set the bridge port and token in Settings, make sure the
            CLI is running, then connect.
          </span>
          <Button size="sm" className="h-7 shrink-0 px-3 text-xs" disabled={connecting} onClick={connect}>
            {connecting ? "Connecting…" : "Connect"}
          </Button>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
      <div
        className="h-full overflow-y-auto px-3 py-4 space-y-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-600/15 text-2xl">
              💬
            </div>
            <p className="text-sm font-medium text-foreground">No conversation yet</p>
            <p className="max-w-[220px] text-xs">Pick a conversation above to resume, or send a message to start a new one.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "group flex justify-end" : "group flex justify-start"}>
            {m.role === "tool" ? (
              <details className="max-w-[85%] rounded-2xl border border-border/60 bg-background/60 font-mono text-xs text-muted-foreground open:w-full">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-1 [&::-webkit-details-marker]:hidden">
                  {m.ok === undefined ? (
                    <span className="text-indigo-500">⚙</span>
                  ) : m.ok ? (
                    <span className="text-emerald-500">✓</span>
                  ) : (
                    <span className="text-red-500">✗</span>
                  )}
                  <span className="truncate">{toolLabel(m.content, m.args)}</span>
                </summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-border/60 px-3 py-2">
                  {m.args ? prettyArgs(m.args) : m.content}
                </pre>
                {m.result && (
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-border/60 px-3 py-2 text-foreground/80">
                    {m.result}
                  </pre>
                )}
                {m.error && <pre className="whitespace-pre-wrap break-all border-t border-border/60 px-3 py-2 text-red-500">{m.error}</pre>}
              </details>
            ) : (
              <div className={m.role === "user" ? "flex max-w-[85%] flex-col items-end" : "flex max-w-[85%] flex-col items-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-3.5 py-2 text-white shadow-sm whitespace-pre-wrap"
                      : m.role === "reasoning"
                        ? "rounded-2xl rounded-bl-md border border-dashed border-border/60 bg-background/40 px-3.5 py-2 text-xs italic text-muted-foreground whitespace-pre-wrap"
                        : "rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2 text-card-foreground shadow-sm"
                  }
                >
                  {m.role === "assistant" ? <Markdown text={m.content} artifactBase={artifactBase} /> : m.content}
                </div>
                <CopyButton text={m.content} />
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {!atBottom && (
        <Button
          size="icon-xs"
          variant="secondary"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border/60 shadow-md"
          aria-label="Scroll to bottom"
          onClick={() => {
            setAtBottom(true);
            endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
          }}
        >
          <ArrowDown />
        </Button>
      )}
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

      {connected && running && !pendingApproval && (
        <div className="flex items-center gap-2 border-t border-border/60 bg-background/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="size-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="size-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
          <span>Working…</span>
        </div>
      )}

      <div className="border-t border-border/60 bg-background/80 p-3 backdrop-blur-sm">
        <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card p-1.5 shadow-sm transition-colors focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Textarea
            ref={taRef}
            rows={2}
            placeholder="Message the agent…"
            value={draft}
            className="min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
            onChange={(e) => {
              setDraft(e.target.value);
              updateSkillMenu();
            }}
            onBlur={() => setMenu(null)}
            onKeyDown={(e) => {
              if (menu && e.key === "Escape") {
                e.preventDefault();
                setMenu(null);
                return;
              }
              if (menu && menu.results.length) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMenu({ ...menu, active: (menu.active + 1) % menu.results.length });
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMenu({ ...menu, active: (menu.active - 1 + menu.results.length) % menu.results.length });
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  commitSkill(menu.active);
                  return;
                }
              }
              // The CLI's shared shell input history, mirroring the TUI's
              // HistoryManager: ArrowUp always recalls (stashing the current
              // draft on entry), ArrowDown walks newer and finally restores
              // the stashed draft.
              if (e.key === "ArrowUp" && history.length) {
                e.preventDefault();
                if (histIdx < 0) histStash.current = draft;
                const next = Math.min(histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1), history.length - 1);
                setHistIdx(next);
                setDraft(history[next]);
                return;
              }
              if (e.key === "ArrowDown" && histIdx >= 0) {
                e.preventDefault();
                const next = histIdx + 1;
                if (next >= history.length) {
                  setHistIdx(-1);
                  setDraft(histStash.current);
                  histStash.current = "";
                } else {
                  setHistIdx(next);
                  setDraft(history[next]);
                }
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          {connected && running ? (
            <Button
              size="icon-sm"
              onClick={() => portRef.current?.postMessage({ type: "interrupt" } satisfies PanelInterrupt)}
              className="bg-red-500 text-white hover:bg-red-600"
              aria-label="Stop generating"
            >
              ■
            </Button>
          ) : (
            <Button
              size="icon-sm"
              disabled={!connected || !draft.trim()}
              onClick={sendMessage}
              className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:opacity-90"
              aria-label="Send message"
            >
              ↑
            </Button>
          )}
        </div>
        {menu && (
          <SkillMenu
            results={menu.results}
            activeIndex={menu.active}
            pos={menu.pos}
            onHover={(i) => setMenu({ ...menu, active: i })}
            onSelect={commitSkill}
          />
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
