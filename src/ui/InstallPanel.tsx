import { useEffect, useRef, useState } from "react";
import * as storage from "../shared/storage";
import { MODELS } from "../shared/models";
import { DEFAULT_PROMPTS, mergePrompts, type Prompt } from "../shared/prompts";
import type { GpuState } from "../shared/messages";
import { ask } from "./ask";

type State =
  | { kind: "checking" }
  | { kind: "ready"; installed: boolean; fileUrl?: string; error?: string };

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; url: string; issue: boolean }
  | { kind: "error"; message: string };

export function InstallPanel({ owner, repo, onClose }: { owner: string; repo: string; onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [gpuModel, setGpuModel] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>(DEFAULT_PROMPTS);
  const [task, setTask] = useState("");
  const [createIssue, setCreateIssue] = useState(true);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      setPrompts(mergePrompts(await storage.get<Prompt[]>("prompts")));
    })();
    ask({ type: "gpu-status" }, (resp) => {
      const state = (resp as { state?: GpuState }).state;
      const hf = state?.hf ?? state?.modelId;
      if (state?.status === "running" && hf) setGpuModel(`llamacpp/${hf}`);
    });
    ask({ type: "check-install", owner, repo }, (resp) => {
      if (chrome.runtime?.lastError || !resp) return setState({ kind: "ready", installed: false, error: "Failed to check install status." });
      if (resp.error) return setState({ kind: "ready", installed: false, error: resp.error });
      setState({ kind: "ready", installed: resp.installed as boolean, fileUrl: resp.url as string | undefined });
    });
  }, [owner, repo]);

  function insertTemplate(raw: string) {
    const text = raw.replace(/^@opentask\b[ \t]*/i, "");
    const ta = taRef.current;
    if (!ta) return setTask((t) => t + text);
    const start = ta.selectionStart ?? task.length;
    const end = ta.selectionEnd ?? task.length;
    setTask(task.slice(0, start) + text + task.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function sendTask() {
    if (!task.trim()) return;
    setSend({ kind: "sending" });
    const msg = createIssue
      ? { type: "create-task", owner, repo, prompt: task }
      : { type: "dispatch-task", owner, repo, model, prompt: task };
    ask(msg, (resp) => {
      if (chrome.runtime?.lastError || !resp) return setSend({ kind: "error", message: "Failed to send task." });
      if (resp.error) return setSend({ kind: "error", message: resp.error });
      setSend({ kind: "sent", url: resp.url as string, issue: createIssue });
      setTask("");
      onClose();
    });
  }

  return (
    <div className="igw-tasks-panel">
      <div className="igw-tasks-header">
        <button className="igw-tasks-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="igw-tasks-body">
        <p className="igw-tasks-repo">{owner}/{repo}</p>

        {state.kind === "checking" && <p className="igw-tasks-muted">Checking…</p>}

        {state.kind === "ready" && state.error && <p className="igw-tasks-error">{state.error}</p>}

        {state.kind === "ready" && !state.error && state.installed && (
          <>
            <label className="igw-tasks-label" htmlFor="igw-task-input">New task</label>
            <textarea
              id="igw-task-input"
              ref={taRef}
              className="igw-tasks-textarea"
              rows={4}
              placeholder="Describe a task for the OpenTask agent…"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
            {prompts.length > 0 && (
              <select
                className="igw-tasks-select"
                value=""
                onChange={(e) => {
                  const p = prompts.find((x) => x.id === e.target.value);
                  if (p) insertTemplate(p.insert);
                }}
              >
                <option value="" disabled>Insert template…</option>
                {prompts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
            <label className="igw-tasks-check">
              <input type="checkbox" checked={createIssue} onChange={(e) => setCreateIssue(e.target.checked)} />
              <span>Create a GitHub issue</span>
            </label>
            {!createIssue && (
              <select
                className="igw-tasks-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Model for this run"
              >
                <option value="">Repository default (DEFAULT_MODEL)</option>
                {gpuModel && <option value={gpuModel}>{gpuModel}</option>}
                {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <button
              className="igw-tasks-btn"
              onClick={sendTask}
              disabled={send.kind === "sending" || !task.trim()}
            >
              {send.kind === "sending" ? "Sending…" : createIssue ? "Send task" : "Run task"}
            </button>
            {send.kind === "sent" && (
              <p className="igw-tasks-success">
                {send.issue ? "Issue created" : "Run started"} -{" "}
                <a className="igw-tasks-link" href={send.url} target="_blank" rel="noopener noreferrer">
                  {send.issue ? "view issue" : "view Actions"}
                </a>
              </p>
            )}
            {send.kind === "error" && <p className="igw-tasks-error">{send.message}</p>}
            {state.fileUrl && (
              <a className="igw-tasks-link" href={state.fileUrl} target="_blank" rel="noopener noreferrer">View workflow file</a>
            )}
          </>
        )}

        {state.kind === "ready" && !state.error && !state.installed && (
          <p className="igw-tasks-muted">
            The OpenTask workflow is not installed here. Install it from the extension's
            Options → Install tab.
          </p>
        )}
      </div>
    </div>
  );
}
