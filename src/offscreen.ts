import { RECORD_FPS, normalizeRecordCap, recordingBitrate, recordingFilename, recordingMime, type RecordState } from "./shared/recording";
import type { Attachment } from "./shared/agui";

let recorder: MediaRecorder | undefined;
let chunks: Blob[] = [];
let mime = "video/mp4";
let capTimer: ReturnType<typeof setTimeout> | undefined;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen") return false;
  if (msg.type === "start-recording") {
    startRecording(msg)
      .then((state) => sendResponse({ state }))
      .catch((err) => sendResponse({ error: errorMessage(err) }));
    return true;
  }
  if (msg.type === "stop-recording") {
    stopRecording()
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ error: errorMessage(err) }));
    return true;
  }
  return false;
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Opens the tab-capture stream, starts the recorder, and arms the cap timer.
// Mirrors recording state into the URL hash so the service worker can read it
// cheaply via chrome.runtime.getContexts, even after a worker restart.
async function startRecording(msg: { streamId: string; capSeconds?: unknown }): Promise<RecordState> {
  if (recorder?.state === "recording") throw new Error("A recording is already running.");
  const capSeconds = normalizeRecordCap(msg.capSeconds);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: msg.streamId,
        maxFrameRate: RECORD_FPS,
      },
    },
  } as MediaStreamConstraints);
  mime = recordingMime((m) => MediaRecorder.isTypeSupported(m));
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: recordingBitrate(capSeconds) });
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    window.location.hash = "";
  };
  recorder.start();
  window.location.hash = "recording";
  const startedAt = Date.now();
  capTimer = setTimeout(() => void capStop(), capSeconds * 1000);
  return { status: "recording", startedAt, capSeconds, mime };
}

// Stops the recorder (or collects a stop that already happened, e.g. the captured
// tab closing) and waits for the muxed file, so the caller gets it in the response.
async function stopRecording(): Promise<RecordState & { recording?: Attachment }> {
  clearTimeout(capTimer);
  capTimer = undefined;
  const rec = recorder;
  if (!rec) return { status: "idle" };
  recorder = undefined;
  if (rec.state !== "inactive") {
    const stopped = waitForStop(rec);
    window.location.hash = "";
    rec.stop();
    rec.stream.getTracks().forEach((t) => t.stop());
    await stopped;
  }
  return { status: "idle", recording: await muxRecording() };
}

// stop() fires its events in a later task, so the chunks only hold the whole
// capture once the stop event has landed; muxing before that drops the tail.
function waitForStop(rec: MediaRecorder): Promise<void> {
  return new Promise((resolve) => rec.addEventListener("stop", () => resolve(), { once: true }));
}

// The cap stops a recording no caller is waiting on, so its file goes to the service
// worker, which holds it until the panel claims it.
async function capStop(): Promise<void> {
  const { recording } = await stopRecording();
  if (!recording) return;
  void chrome.runtime.sendMessage({ type: "record-saved", recording }).catch(() => {});
}

// Muxes the chunks into the attachment the connected CLI writes on its own host: an
// offscreen document gets chrome.runtime alone, so the bytes travel to the service
// worker as base64 rather than as a blob URL it cannot read.
function muxRecording(): Promise<Attachment> {
  const blob = new Blob(chunks, { type: mime });
  chunks = [];
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        filename: recordingFilename(Date.now(), mime.endsWith("webm") ? "webm" : "mp4"),
        mime_type: mime,
        data: String(reader.result ?? "").split(",")[1] ?? "",
      });
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the recording."));
    reader.readAsDataURL(blob);
  });
}
