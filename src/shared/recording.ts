import type { Attachment } from "./agui";

export const RECORD_FPS = 10;

// Recording hard-stop in seconds: the default and the enforced bounds.
export const RECORD_CAP_DEFAULT = 60;
export const RECORD_CAP_MIN = 5;
export const RECORD_CAP_MAX = 300;

// GitHub rejects attachments over 10 MB; the bitrate budget targets this.
export const RECORD_MAX_BYTES = 10 * 1000 * 1000;
export const RECORD_BITRATE_MIN = 250_000;
export const RECORD_BITRATE_MAX = 5_000_000;

export type RecordState = {
  status: "idle" | "recording";
  startedAt?: number;
  capSeconds?: number;
  mime?: string;
};

// Clamps the stored cap setting to the enforced bounds; anything non-numeric
// falls back to the default.
export function normalizeRecordCap(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return RECORD_CAP_DEFAULT;
  return Math.min(RECORD_CAP_MAX, Math.max(RECORD_CAP_MIN, Math.round(n)));
}

// Tab recording needs the Chrome/Edge-only tabCapture + offscreen APIs;
// Firefox and Safari builds hide the control instead of shipping a broken one.
export function supportsTabCapture(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.tabCapture?.getMediaStreamId === "function" &&
    typeof chrome.offscreen?.createDocument === "function"
  );
}

// mp4 muxing is supported by MediaRecorder in current Chrome and attaches to
// GitHub without transcoding; webm is the fallback where it is unavailable.
export function recordingMime(isTypeSupported: (mime: string) => boolean): "video/mp4" | "video/webm" {
  return isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
}

// videoBitsPerSecond sized so the whole recording fits GitHub's 10 MB
// attachment limit at the cap (10% headroom for container overhead and the
// stop latency), clamped to a usable quality band.
export function recordingBitrate(capSeconds: number, maxBytes: number = RECORD_MAX_BYTES): number {
  const budget = Math.floor(((maxBytes * 0.9) / Math.max(1, capSeconds)) * 8);
  return Math.min(RECORD_BITRATE_MAX, Math.max(RECORD_BITRATE_MIN, budget));
}

// Collision-free download name: opentask-recording-20260926-134505.mp4.
export function recordingFilename(now: number = Date.now(), ext: string = "mp4"): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `opentask-recording-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

// "m:ss" timer shown while recording.
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Holds a finished capture until the panel claims it: take clears the box, so a
// status poll can never attach the same recording twice. The box lives in
// service-worker memory, so a restart between save and claim drops the capture.
export type RecordingBox = {
  hold: (recording: Attachment) => void;
  take: () => Attachment | undefined;
};

export function createRecordingBox(): RecordingBox {
  let held: Attachment | undefined;
  return {
    hold: (recording) => {
      held = recording;
    },
    take: () => {
      const recording = held;
      held = undefined;
      return recording;
    },
  };
}

// Composer line for a recorded tab: tells the agent the attachment is a captured
// flow to learn from, which frame extractor to use, and that it confirms the skill
// before writing one. Naming the bundled ffmpeg keeps it from hunting for a system
// one (or a computer-use toolchain) it has no business installing.
export function recordingLine(filename: string): string {
  return `[recording: ${filename} - a capture of the flow. Extract frames with the bundled ${FFMPEG} (no installs, no other video tooling), inspect them, then ask whether to save this flow as a skill.]`;
}

// The composer line for a capture, or "" when the text already carries it: a
// claimed recording pre-fills the composer, so appending it again on send would
// tell the agent the same thing twice.
export function recordingFooter(text: string, recording: Attachment | undefined): string {
  if (!recording) return "";
  const line = recordingLine(recording.filename);
  return text.includes(line) ? "" : line;
}

const FFMPEG = "~/.infer/bin/tools/ffmpeg";
const INSTALL_SH = "https://raw.githubusercontent.com/inference-gateway/binaries/main/install.sh";

// Shell that prints the byte size of the frame extractor recordingLine names, and fails
// when it is missing. `wc` and the release query below are on the CLI's default Bash
// allowlist, so checking a present ffmpeg never puts a prompt in front of the user.
export function frameToolsSizeCommand(): string {
  return `wc -c ${FFMPEG}`;
}

// Shell that prints the byte sizes of the latest release's ffmpeg builds, one per line.
export function frameToolsReleaseCommand(): string {
  return `gh release view -R inference-gateway/binaries --json assets --jq '.assets[] | select(.name | startswith("ffmpeg-")) | .size'`;
}

// Whether the installed ffmpeg (`wc -c` output) matches none of the latest release's
// builds. Unreadable output on either side counts as current, so a failed check never
// replaces a working binary.
// ponytail: compares sizes, not hashes (hashing isn't approval-free); install.sh
// verifies the sha256 of what it downloads.
export function isFrameToolStale(localWc: string, releaseSizes: string): boolean {
  const local = localWc.trim().split(/\s+/)[0];
  const latest = releaseSizes.split("\n").map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
  return /^\d+$/.test(local) && latest.length > 0 && !latest.includes(local);
}

// Shell that installs that extractor: the CLI only auto-downloads the speech
// binaries, so the extension runs inference-gateway/binaries' installer, which picks
// this host's build, verifies it against the release checksums, and uses gh if authed.
// Fetched before it runs, so a failed download fails the command instead of piping
// an empty script into a shell that would exit 0.
export function frameToolsCommand(): string {
  return [
    `# opentask: download the latest ffmpeg to ${FFMPEG} so the agent can extract frames from your recording`,
    `script=$(curl -fsSL ${INSTALL_SH}) && sh -c "$script" install.sh ffmpeg`,
  ].join("\n");
}

// Chrome mints a capture token only for a tab the extension was invoked on (the
// toolbar icon, a context menu, a command); a click inside the side panel is not
// an invocation, so a tab the user switched to is out of reach and the message
// has to name the way back instead of repeating Chrome's jargon.
export function captureFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return /invoked/i.test(message)
    ? "OpenTask can only record a tab you opened it on - click the OpenTask toolbar icon on the tab you want to record."
    : message;
}

// Outlines a captured tab so it is obvious on the page itself; call with false to
// clear it. It runs inside the recorded page via chrome.scripting, so it stays
// self-contained (no imports, no captured variables) - and its border lands in the
// recording, which captures page pixels.
export function paintRecordingOverlay(on: boolean): void {
  const existing = document.getElementById("opentask-recording-overlay");
  if (existing) existing.remove();
  if (!on) return;
  const overlay = document.createElement("div");
  overlay.id = "opentask-recording-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText =
    "position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; border: 4px solid #ef4444; box-shadow: inset 0 0 16px rgba(239, 68, 68, 0.45);";
  (document.body || document.documentElement).append(overlay);
}
