import { useEffect, useRef, useState } from "react";
import { Button } from "@/ui/components/button";
import { ask } from "./ask";
import { captureFailureMessage, formatElapsed, supportsTabCapture, type RecordState } from "@/shared/recording";
import type { Attachment } from "@/shared/agui";
import type { RecordStartResponse, RecordStatusResponse, RecordStopResponse, RecordTakeResponse } from "@/shared/messages";

const CLAIM_RETRIES = 5;
const CLAIM_RETRY_MS = 1000;

// Starts a tab recording with a stream id minted on the click gesture - the
// user-activation requirement lives here, in the extension page. Polls the
// background for status while recording and offers the stop control. With
// onRecording set (the side panel) the finished capture is handed to that composer;
// without it (the popup) the worker keeps the capture for the panel to claim.
export function RecordButton({ onRecording }: { onRecording?: (recording: Attachment) => void }) {
  const [state, setState] = useState<RecordState>({ status: "idle" });
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sawRecording = useRef(false);
  const handler = useRef(onRecording);

  useEffect(() => {
    handler.current = onRecording;
  });

  function refresh() {
    ask({ type: "record-status" }, (resp) => {
      const r = resp as RecordStatusResponse;
      if (r?.state) setState(r.state);
    });
  }

  // Claims the capture the worker holds. The offscreen recorder muxes the file a
  // moment after the stop, so a claim made right after one retries briefly.
  function claim(retries: number) {
    if (!handler.current) return;
    ask({ type: "record-take" }, (resp) => {
      const r = resp as RecordTakeResponse;
      if (r?.recording) return handler.current?.(r.recording);
      if (retries > 0) retryTimer.current = setTimeout(() => claim(retries - 1), CLAIM_RETRY_MS);
    });
  }

  useEffect(() => {
    refresh();
    claim(0);
    return () => clearTimeout(retryTimer.current);
  }, []);

  // The popup can record a tab this panel cannot (it is invoked from the
  // toolbar), so its capture needs a nudge to reach the composer: the worker
  // announces a held capture and the panel takes it out of the box.
  useEffect(() => {
    function onAvailable() {
      claim(0);
    }
    chrome.runtime.onMessage.addListener(onAvailable);
    return () => chrome.runtime.onMessage.removeListener(onAvailable);
  }, []);

  const recording = state.status === "recording";
  useEffect(() => {
    if (recording) {
      sawRecording.current = true;
      return;
    }
    if (!sawRecording.current) return;
    sawRecording.current = false;
    claim(CLAIM_RETRIES);
  }, [recording]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      refresh();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    setError("");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return setError("No active tab to record.");
    let streamId: string;
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    } catch (err) {
      return setError(captureFailureMessage(err));
    }
    ask({ type: "record-start", streamId, tabId: tab.id }, (resp) => {
      const r = resp as RecordStartResponse;
      if ("error" in r) setError(r.error);
      refresh();
    });
  }

  function stop() {
    setError("");
    ask({ type: "record-stop" }, (resp) => {
      const r = resp as RecordStopResponse;
      if ("error" in r) setError(r.error);
      refresh();
    });
  }

  if (!supportsTabCapture()) return null;

  const cap = state.capSeconds ? ` / ${formatElapsed(state.capSeconds * 1000)}` : "";
  const elapsed = state.startedAt ? `${formatElapsed(now - state.startedAt)}${cap}` : "Recording";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {recording ? (
          <>
            <span className="inline-block size-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span className="text-xs tabular-nums text-muted-foreground">{elapsed}</span>
            <Button size="xs" variant="destructive" className="ml-auto" onClick={stop}>
              Stop
            </Button>
          </>
        ) : (
          <Button size="xs" variant="outline" onClick={() => void start()}>
            <span className="mr-1.5 inline-block size-2 rounded-full bg-red-500" aria-hidden="true" />
            Record tab
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
