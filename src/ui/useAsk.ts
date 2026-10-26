import { useCallback, useEffect, useState } from "react";
import { ask } from "./ask";

export type AskStatus<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: T };

// The loading/error/ready fetch boilerplate that Skills/Agents/Install panels each
// hand-rolled around ask(). `message` is (re)sent on mount and whenever `deps` change;
// `reload()` re-sends on demand. Discriminated-union status is the panel's single source
// of truth for what to render.
export function useAsk<T>(
  message: unknown,
  fallbackError: string,
  deps: unknown[]
): { status: AskStatus<T>; reload: () => void } {
  const [status, setStatus] = useState<AskStatus<T>>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    ask(message, (resp) => {
      if (cancelled) return;
      if (chrome.runtime?.lastError || !resp) return setStatus({ kind: "error", message: fallbackError });
      if (resp.error) return setStatus({ kind: "error", message: resp.error });
      setStatus({ kind: "ready", data: resp as T });
    });
    return () => {
      cancelled = true;
    };
    // message is derived from deps; re-send when deps (or nonce) change.
  }, [...deps, nonce]);

  return { status, reload };
}
