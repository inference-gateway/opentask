import { useEffect, useState } from "react";
import * as storage from "../shared/storage";
import { DEFAULT_INIT, isInitConfig, type InitConfig } from "../shared/models";
import { ask } from "./ask";

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; url: string }
  | { kind: "error"; message: string };

// Popover for the "Init" repo-nav button. Shows what will be scaffolded (AGENTS.md always,
// plus the extras enabled in Settings) and dispatches the installed workflow to do it.
export function InitPanel({ owner, repo, onClose }: { owner: string; repo: string; onClose: () => void }) {
  const [cfg, setCfg] = useState<InitConfig>(DEFAULT_INIT);
  const [send, setSend] = useState<SendState>({ kind: "idle" });

  useEffect(() => {
    void (async () => {
      const stored = await storage.get<unknown>("init");
      setCfg(isInitConfig(stored) ? stored : DEFAULT_INIT);
    })();
  }, []);

  function doInit() {
    setSend({ kind: "sending" });
    ask({ type: "init-project", owner, repo }, (resp) => {
      if (chrome.runtime?.lastError || !resp)
        return setSend({ kind: "error", message: "Failed to send init request." });
      if (resp.error) return setSend({ kind: "error", message: resp.error });
      setSend({ kind: "sent", url: resp.url as string });
    });
  }

  const extras = [
    { on: cfg.githooks, label: "Add .githooks/pre-commit" },
    { on: cfg.claudeSymlink, label: "Symlink CLAUDE.md → AGENTS.md" },
    { on: cfg.skillsSymlink, label: "Symlink .claude/skills → .agents/skills" },
  ];

  return (
    <div className="igw-tasks-panel">
      <div className="igw-tasks-header">
        <button className="igw-tasks-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="igw-tasks-body">
        <p className="igw-tasks-repo">
          {owner}/{repo}
        </p>
        <p className="igw-tasks-muted">
          The OpenTask agent will generate an <code>AGENTS.md</code> and open a pull request.
        </p>
        <ul className="igw-tasks-list">
          <li>Generate AGENTS.md</li>
          {extras
            .filter((e) => e.on)
            .map((e) => (
              <li key={e.label}>{e.label}</li>
            ))}
        </ul>
        <p className="igw-tasks-muted">
          Toggle the extras in{" "}
          <a
            className="igw-tasks-link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              chrome.runtime.openOptionsPage();
            }}
          >
            Settings
          </a>
          .
        </p>
        <button className="igw-tasks-btn" onClick={doInit} disabled={send.kind === "sending"}>
          {send.kind === "sending" ? "Starting…" : "Initialize project"}
        </button>
        {send.kind === "sent" && (
          <p className="igw-tasks-success">
            Run started -{" "}
            <a className="igw-tasks-link" href={send.url} target="_blank" rel="noopener noreferrer">
              view Actions
            </a>
          </p>
        )}
        {send.kind === "error" && <p className="igw-tasks-error">{send.message}</p>}
      </div>
    </div>
  );
}
